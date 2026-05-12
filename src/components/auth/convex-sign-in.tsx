"use client";

import { useEffect, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Zap, Target, ArrowRight } from "lucide-react";

/** Matches backend Password defaults: min length 8, non-empty */
const MIN_PASSWORD_LENGTH = 8;

const PENDING_EMAIL_VERIFY_KEY = "quizbuilder_pending_email_verify";
const RESEND_COOLDOWN_UNTIL_KEY = "quizbuilder_resend_cooldown_until";

const RESEND_COOLDOWN_MS = 60_000;

/**
 * Maps Convex Auth / our `convex/auth.ts` errors to clear copy.
 * Keep aligned with `AUTH_MSG` in `convex/auth.ts`.
 */
export function formatPasswordAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  // @convex-dev/auth createAccountFromCredentials: duplicate email sign-up before our createOrUpdateUser runs
  if (raw.includes("Account ") && raw.includes("already exists")) {
    return "Email already exists.";
  }

  // Our ConvexError messages (exact or wrapped by runtime)
  if (
    raw.includes("Please sign in with Google") ||
    raw.includes("sign in with Google.")
  ) {
    return "This email is already registered. Please sign in with Google.";
  }
  if (
    raw.includes("This email is already registered") &&
    raw.includes("Please sign in.") &&
    !raw.includes("Google")
  ) {
    return "This email is already registered. Please sign in.";
  }
  if (
    raw.includes("username is already taken") ||
    raw.includes("Username is already taken")
  ) {
    return "This username is already taken.";
  }
  if (raw.includes("Username is required")) {
    return "Username is required.";
  }
  if (raw.includes("Username must be between 2 and 32")) {
    return "Username must be between 2 and 32 characters.";
  }
  if (raw.includes("Username may only contain")) {
    return "Username may only contain lowercase letters, numbers, and underscores.";
  }

  // Legacy wording / partial matches
  if (raw.includes("An account with this email already exists")) {
    if (raw.includes("Google")) {
      return "This email is already registered. Please sign in with Google.";
    }
    return "This email is already registered. Please sign in.";
  }

  // Password / credential failures
  if (raw.includes("Invalid password")) {
    return "Password must be at least 8 characters.";
  }
  if (
    raw.includes("InvalidSecret") ||
    raw.includes("InvalidAccountId") ||
    raw.includes("Invalid credentials")
  ) {
    return "Incorrect email or password.";
  }
  if (raw.includes("TooManyFailedAttempts")) {
    return "Too many sign-in attempts. Please try again later.";
  }
  if (
    raw.includes("Could not verify code") ||
    raw.includes("Invalid code")
  ) {
    return "Invalid or expired verification code.";
  }
  if (raw.includes("SendGrid error")) {
    return "Email could not be sent. Check SendGrid Activity and Convex AUTH_SENDGRID_API_KEY / AUTH_SENDGRID_FROM.";
  }
  if (raw.includes("AUTH_SENDGRID")) {
    return "Email is not configured. Set AUTH_SENDGRID_API_KEY and AUTH_SENDGRID_FROM in Convex (verified sender).";
  }

  if (
    raw.includes("administrator account already exists") ||
    raw.includes("An administrator account already exists")
  ) {
    return "An administrator account already exists. Please sign in.";
  }
  if (raw.includes("Invalid or missing setup token")) {
    return "Invalid or missing setup token.";
  }
  if (raw.includes("Email is required")) {
    return "Email is required.";
  }

  return raw;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function ConvexSignIn() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.currentUser);
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Email OTP step: password submitted; user must enter code from email */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [resendCooldownUntil, setResendCooldownUntil] = useState<number | null>(
    null,
  );
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());

  useEffect(() => {
    if (!resendCooldownUntil) return;
    const until = resendCooldownUntil;
    const id = setInterval(() => {
      const t = Date.now();
      setCooldownNow(t);
      if (t >= until) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldownUntil]);

  const resendWaitSeconds =
    resendCooldownUntil && cooldownNow < resendCooldownUntil
      ? Math.ceil((resendCooldownUntil - cooldownNow) / 1000)
      : 0;

  const scheduleResendCooldown = () => {
    const until = Date.now() + RESEND_COOLDOWN_MS;
    setResendCooldownUntil(until);
    setCooldownNow(Date.now());
    sessionStorage.setItem(RESEND_COOLDOWN_UNTIL_KEY, String(until));
  };

  const clearVerificationStep = () => {
    sessionStorage.removeItem(PENDING_EMAIL_VERIFY_KEY);
    sessionStorage.removeItem(RESEND_COOLDOWN_UNTIL_KEY);
    setPendingEmail(null);
    setEmailCode("");
    setResendCooldownUntil(null);
  };

  useEffect(() => {
    if (user?.emailVerificationTime !== undefined) {
      sessionStorage.removeItem(PENDING_EMAIL_VERIFY_KEY);
      sessionStorage.removeItem(RESEND_COOLDOWN_UNTIL_KEY);
      setPendingEmail(null);
      setResendCooldownUntil(null);
    }
  }, [user?.emailVerificationTime]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (user === undefined || user === null) return;
    if (user.emailVerificationTime !== undefined) return;
    const stored = sessionStorage.getItem(PENDING_EMAIL_VERIFY_KEY);
    if (!stored) return;
    setPendingEmail(stored);
    const untilRaw = sessionStorage.getItem(RESEND_COOLDOWN_UNTIL_KEY);
    if (untilRaw) {
      const until = parseInt(untilRaw, 10);
      if (!Number.isNaN(until) && until > Date.now()) {
        setResendCooldownUntil(until);
        setCooldownNow(Date.now());
      }
    }
  }, [isAuthenticated, user]);

  const handleGoogleSignIn = () => {
    setError(null);
    clearVerificationStep();
    void signIn("google");
  };

  const handlePasswordAuth = async () => {
    setError(null);
    if (mode === "signUp") {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const result = await signIn("password", {
        flow: mode,
        email: email.trim(),
        password,
        ...(mode === "signUp" ? { username: username.trim().toLowerCase() } : {}),
      });
      const em = email.trim();
      if (!result.signingIn) {
        sessionStorage.setItem(PENDING_EMAIL_VERIFY_KEY, em);
        setPendingEmail(em);
        setEmailCode("");
        scheduleResendCooldown();
        return;
      }
      sessionStorage.removeItem(PENDING_EMAIL_VERIFY_KEY);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(formatPasswordAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerificationCode = async () => {
    if (!pendingEmail) return;
    if (resendCooldownUntil !== null && Date.now() < resendCooldownUntil) {
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        "Enter your password below to resend the code (needed if you refreshed this page).",
      );
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await signIn("password", {
        flow: "signIn",
        email: pendingEmail,
        password,
      });
      if (result.signingIn) {
        sessionStorage.removeItem(PENDING_EMAIL_VERIFY_KEY);
        setPendingEmail(null);
        setEmailCode("");
        return;
      }
      scheduleResendCooldown();
      setEmailCode("");
    } catch (err) {
      setError(formatPasswordAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailVerification = async () => {
    if (!pendingEmail) return;
    setError(null);
    const code = emailCode.trim();
    if (code.length < 4) {
      setError("Please enter the code from your email.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await signIn("password", {
        flow: "email-verification",
        email: pendingEmail,
        code,
      });
      if (!result.signingIn) {
        setError("Could not complete sign-in. Please try again.");
        return;
      }
      clearVerificationStep();
      setPassword("");
      setConfirmPassword("");
      setUsername("");
    } catch (err) {
      setError(formatPasswordAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const usernameNormalized = username.trim().toLowerCase();
  const usernameOk =
    mode === "signIn" ||
    (/^[a-z0-9_]{2,32}$/.test(usernameNormalized) && usernameNormalized.length > 0);
  const passwordOk = password.length >= MIN_PASSWORD_LENGTH;
  const confirmOk =
    mode === "signIn" || (password === confirmPassword && confirmPassword.length >= MIN_PASSWORD_LENGTH);
  const canSubmitPassword =
    email.trim().length > 0 &&
    passwordOk &&
    (mode === "signIn" || (confirmOk && usernameOk));
  const canSubmitEmailCode = emailCode.trim().length >= 4;

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
        {/* Geometric pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 border border-white/30 rounded-full" />
          <div className="absolute top-40 left-40 w-96 h-96 border border-white/20 rounded-full" />
          <div className="absolute bottom-20 right-20 w-64 h-64 border border-emerald-400/30 rounded-full" />
          <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] border border-cyan-400/20 rounded-full" />
        </div>

        {/* Floating shapes */}
        <div className="absolute top-1/4 right-1/4 w-4 h-4 bg-emerald-400 rounded-full animate-pulse" />
        <div className="absolute top-1/3 left-1/4 w-3 h-3 bg-cyan-400 rounded-full animate-pulse delay-300" />
        <div className="absolute bottom-1/3 right-1/3 w-5 h-5 bg-violet-400 rounded-full animate-pulse delay-700" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 py-12">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-8">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-white/80 font-medium">Create interactive quizzes</span>
            </div>

            <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
              Build engaging
              <br />
              <span className="text-emerald-400">
                visual quizzes
              </span>
            </h1>

            <p className="text-lg text-slate-300 max-w-md leading-relaxed">
              Transform your ideas into captivating quiz experiences that engage and delight your audience.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
                <Zap className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Lightning Fast</h3>
                <p className="text-slate-400 text-sm">Build quizzes in minutes, not hours</p>
              </div>
            </div>

            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center group-hover:bg-cyan-500/30 transition-colors">
                <Target className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Pixel Perfect</h3>
                <p className="text-slate-400 text-sm">Customize every detail to match your brand</p>
              </div>
            </div>

            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center group-hover:bg-violet-500/30 transition-colors">
                <Sparkles className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Beautiful Results</h3>
                <p className="text-slate-400 text-sm">Stunning result pages that convert</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-slate-50 relative">
        <div className="relative z-10 w-full max-w-md px-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 mb-4">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-white font-medium">Vision Verse</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/50 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {pendingEmail
                  ? "Check your email"
                  : mode === "signIn"
                    ? "Welcome back"
                    : "Create account"}
              </h2>
              <p className="text-slate-500">
                {pendingEmail
                  ? `We sent a verification code to ${pendingEmail}. Check spam folder.`
                  : mode === "signIn"
                    ? "Sign in to continue to your dashboard"
                    : "Register with email and password"}
              </p>
            </div>

            {!pendingEmail && (
              <div className="mb-4 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === "signIn"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                    }`}
                  onClick={() => {
                    setMode("signIn");
                    setError(null);
                    setConfirmPassword("");
                    setUsername("");
                    clearVerificationStep();
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === "signUp"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                    }`}
                  onClick={() => {
                    setMode("signUp");
                    setError(null);
                    setConfirmPassword("");
                    setUsername("");
                    clearVerificationStep();
                  }}
                >
                  Sign up
                </button>
              </div>
            )}

            <div className="space-y-3 mb-4">
              {pendingEmail ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="auth-email-code" className="text-slate-700">
                      Verification code
                    </Label>
                    <Input
                      id="auth-email-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter the code from the email"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                    />
                  </div>
                  {password.length < MIN_PASSWORD_LENGTH && (
                    <div className="space-y-2">
                      <Label htmlFor="auth-resend-password" className="text-slate-700">
                        Password (to resend code)
                      </Label>
                      <Input
                        id="auth-resend-password"
                        type="password"
                        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                    </div>
                  )}
                  {error && (
                    <p className="text-sm text-red-600" role="alert">
                      {error}
                    </p>
                  )}
                  <Button
                    type="button"
                    onClick={() => void handleEmailVerification()}
                    disabled={isSubmitting || !canSubmitEmailCode}
                    className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800"
                  >
                    {isSubmitting ? "Please wait..." : "Verify and continue"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={
                      resendWaitSeconds > 0
                        ? "w-full h-11 cursor-not-allowed border-slate-200 bg-slate-50 font-normal text-slate-400"
                        : "w-full h-11 border-slate-300 text-slate-700"
                    }
                    onClick={() => void handleResendVerificationCode()}
                    disabled={
                      isSubmitting ||
                      password.length < MIN_PASSWORD_LENGTH ||
                      resendWaitSeconds > 0
                    }
                  >
                    {resendWaitSeconds > 0
                      ? `Resend code in ${resendWaitSeconds}s`
                      : "Resend code"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-slate-600"
                    onClick={() => {
                      setError(null);
                      clearVerificationStep();
                    }}
                  >
                    Back
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="auth-email" className="text-slate-700">
                      Email
                    </Label>
                    <Input
                      id="auth-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  {mode === "signUp" && (
                    <div className="space-y-2">
                      <Label htmlFor="auth-username" className="text-slate-700">
                        Username
                      </Label>
                      <Input
                        id="auth-username"
                        type="text"
                        placeholder="Enter your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="auth-password" className="text-slate-700">
                      Password
                    </Label>
                    <Input
                      id="auth-password"
                      type="password"
                      placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                    />
                  </div>
                  {mode === "signUp" && (
                    <div className="space-y-2">
                      <Label htmlFor="auth-confirm-password" className="text-slate-700">
                        Confirm password
                      </Label>
                      <Input
                        id="auth-confirm-password"
                        type="password"
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                  )}
                  {error && (
                    <p className="text-sm text-red-600" role="alert">
                      {error}
                    </p>
                  )}
                  <Button
                    type="button"
                    onClick={() => void handlePasswordAuth()}
                    disabled={isSubmitting || !canSubmitPassword}
                    className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800"
                  >
                    {isSubmitting
                      ? "Please wait..."
                      : mode === "signIn"
                        ? "Sign in with email"
                        : "Send code & create account"}
                  </Button>
                </>
              )}
            </div>

            {!pendingEmail && (
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs uppercase tracking-wide text-slate-400">Or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            )}

            {!pendingEmail && (
            <Button
              onClick={handleGoogleSignIn}
              className="w-full h-12 bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm hover:shadow group"
              size="lg"
            >
              <GoogleIcon className="mr-3 h-5 w-5" />
              <span className="font-medium">Continue with Google</span>
              <ArrowRight className="ml-2 h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
            </Button>
            )}

            <div className="mt-6 text-center">
              <p className="text-xs text-slate-400">
                By continuing, you agree to our{" "}
                <span className="text-slate-600 hover:text-slate-900 cursor-pointer">Terms of Service</span>
                {" "}and{" "}
                <span className="text-slate-600 hover:text-slate-900 cursor-pointer">Privacy Policy</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
