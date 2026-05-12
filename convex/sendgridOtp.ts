import Resend from "@auth/core/providers/resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * Numeric OTP email (Password `verify` provider) via SendGrid v3 API.
 *
 * Convex env:
 * - AUTH_SENDGRID_API_KEY: SendGrid API key (required)
 * - AUTH_SENDGRID_FROM: Sender, e.g. `QuizBuilder <verify@your-verified-domain.com>` (required).
 *   Must be a verified Sender Identity in SendGrid (single sender or domain auth).
 */

function parseFromHeader(from: string): { email: string; name?: string } {
  const lt = from.lastIndexOf("<");
  const gt = from.lastIndexOf(">");
  if (lt >= 0 && gt > lt) {
    const email = from.slice(lt + 1, gt).trim();
    const namePart = from
      .slice(0, lt)
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim();
    return namePart ? { email, name: namePart } : { email };
  }
  return { email: from.trim() };
}

export const SendGridOtp = Resend({
  id: "sendgrid-otp",
  apiKey: process.env.AUTH_SENDGRID_API_KEY,
  maxAge: 60 * 15,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, "0123456789", 8);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const apiKey = provider.apiKey as string | undefined;
    if (!apiKey?.trim()) {
      throw new Error("Missing AUTH_SENDGRID_API_KEY for SendGrid");
    }
    const envFrom = process.env.AUTH_SENDGRID_FROM?.trim();
    if (!envFrom) {
      throw new Error(
        "Missing AUTH_SENDGRID_FROM (verified sender, e.g. QuizBuilder <noreply@yourdomain.com>)",
      );
    }
    const from = parseFromHeader(envFrom);

    const text = `Your QuizBuilder verification code is: ${token}\n\nIt expires in 15 minutes.`;
    const html = `<p>Your QuizBuilder verification code is:</p><p style="font-size:22px;font-weight:700;letter-spacing:0.1em;">${token}</p><p>It expires in 15 minutes.</p>`;

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from,
        subject: "QuizBuilder email verification code",
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html },
        ],
      }),
    });

    if (!res.ok) {
      let detail: string;
      try {
        detail = JSON.stringify(await res.json());
      } catch {
        detail = await res.text();
      }
      throw new Error(`SendGrid error (${res.status}): ${detail}`);
    }
  },
});
