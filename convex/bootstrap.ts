import { createAccount } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";

const PASSWORD_PROVIDER_ID = "password";

function normalizeEmail(email: string | undefined): string | undefined {
  if (email === undefined || typeof email !== "string") {
    return undefined;
  }
  const t = email.trim().toLowerCase();
  return t.length > 0 ? t : undefined;
}

function normalizeUsername(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const t = raw.trim().toLowerCase();
  return t.length > 0 ? t : undefined;
}

/** True when no user has `role === "admin"` (first-time server setup). */
export const needsAdminBootstrap = query({
  args: {},
  handler: async (ctx) => {
    const admin = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .first();
    return admin === null;
  },
});

/** When true, `bootstrapAdmin` requires a matching `ADMIN_BOOTSTRAP_SECRET` on the server. */
export const bootstrapRequiresSecret = query({
  args: {},
  handler: async () => {
    const s = process.env.ADMIN_BOOTSTRAP_SECRET;
    return typeof s === "string" && s.length > 0;
  },
});

export const markFirstAdmin = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .first();
    if (existing !== null) {
      throw new ConvexError("An administrator account already exists.");
    }
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    await ctx.db.patch(userId, { role: "admin", emailVerificationTime: nowMs });

    // Convex Auth password OTP checks `authAccounts.emailVerified`.
    // Mark the bootstrap admin as verified so password sign-in doesn't require OTP.
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", PASSWORD_PROVIDER_ID),
      )
      .collect();
    for (const a of accounts) {
      await ctx.db.patch(a._id, { emailVerified: nowIso } as any);
    }
  },
});

export const bootstrapAdmin = action({
  args: {
    email: v.string(),
    password: v.string(),
    username: v.string(),
    bootstrapSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const required = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (typeof required === "string" && required.length > 0) {
      if (args.bootstrapSecret !== required) {
        throw new ConvexError("Invalid or missing setup token.");
      }
    }

    const needs = await ctx.runQuery(api.bootstrap.needsAdminBootstrap, {});
    if (!needs) {
      throw new ConvexError("An administrator account already exists.");
    }

    const email = normalizeEmail(args.email);
    if (!email) {
      throw new ConvexError("Email is required.");
    }

    const handle = normalizeUsername(args.username);
    if (!handle) {
      throw new ConvexError("Username is required.");
    }
    if (handle.length < 2 || handle.length > 32) {
      throw new ConvexError("Username must be between 2 and 32 characters.");
    }
    if (!/^[a-z0-9_]+$/.test(handle)) {
      throw new ConvexError(
        "Username may only contain lowercase letters, numbers, and underscores.",
      );
    }

    if (!args.password || args.password.length < 8) {
      throw new ConvexError("Invalid password");
    }

    const { user } = await createAccount(ctx, {
      provider: PASSWORD_PROVIDER_ID,
      account: { id: email, secret: args.password },
      profile: {
        email,
        username: handle,
        name: handle,
      },
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });

    await ctx.runMutation(internal.bootstrap.markFirstAdmin, {
      userId: user._id,
    });

    return { ok: true as const };
  },
});
