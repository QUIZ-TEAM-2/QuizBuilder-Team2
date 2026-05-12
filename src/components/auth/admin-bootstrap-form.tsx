"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, ShieldCheck } from "lucide-react";
import { formatPasswordAuthError } from "./convex-sign-in";

const MIN_PASSWORD_LENGTH = 8;

export default function AdminBootstrapForm() {
  const { signIn } = useAuthActions();
  const bootstrapAdmin = useAction(api.bootstrap.bootstrapAdmin);
  const requiresSecret = useQuery(api.bootstrap.bootstrapRequiresSecret);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const usernameNormalized = username.trim().toLowerCase();
  const usernameOk =
    /^[a-z0-9_]{2,32}$/.test(usernameNormalized) && usernameNormalized.length > 0;
  const passwordOk = password.length >= MIN_PASSWORD_LENGTH;
  const confirmOk =
    password === confirmPassword && confirmPassword.length >= MIN_PASSWORD_LENGTH;
  const secretOk =
    requiresSecret === false ||
    (requiresSecret === true && bootstrapSecret.length > 0);
  const canSubmit =
    email.trim().length > 0 &&
    passwordOk &&
    confirmOk &&
    usernameOk &&
    secretOk &&
    requiresSecret !== undefined;

  const handleSubmit = async () => {
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setIsSubmitting(true);
    try {
      await bootstrapAdmin({
        email: email.trim(),
        password,
        username: usernameNormalized,
        ...(requiresSecret ? { bootstrapSecret } : {}),
      });
      await signIn("password", {
        flow: "signIn",
        email: email.trim(),
        password,
      });
    } catch (err) {
      setError(formatPasswordAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center lg:hidden">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">Vision Verse</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/50 bg-white p-8 shadow-xl shadow-slate-200/50">
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <ShieldCheck className="h-8 w-8" />
            </div>
          </div>
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-2xl font-bold text-slate-900">
              Create administrator account
            </h1>
            <p className="text-sm text-slate-500">
              No administrator exists yet. Register the first admin to manage this
              deployment. After this, use normal sign-in or sign-up.
            </p>
          </div>

          <div className="space-y-3">
            {requiresSecret ? (
              <div className="space-y-2">
                <Label htmlFor="bootstrap-secret" className="text-slate-700">
                  Setup token
                </Label>
                <Input
                  id="bootstrap-secret"
                  type="password"
                  autoComplete="off"
                  placeholder="From ADMIN_BOOTSTRAP_SECRET"
                  value={bootstrapSecret}
                  onChange={(e) => setBootstrapSecret(e.target.value)}
                />
                <p className="text-xs text-slate-400">
                  Set <code className="rounded bg-slate-100 px-1">ADMIN_BOOTSTRAP_SECRET</code>{" "}
                  in Convex environment variables to require this token.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="bootstrap-email" className="text-slate-700">
                Email
              </Label>
              <Input
                id="bootstrap-email"
                type="email"
                autoComplete="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bootstrap-username" className="text-slate-700">
                Username
              </Label>
              <Input
                id="bootstrap-username"
                autoComplete="username"
                placeholder="lowercase_letters_123"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bootstrap-password" className="text-slate-700">
                Password
              </Label>
              <Input
                id="bootstrap-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bootstrap-confirm" className="text-slate-700">
                Confirm password
              </Label>
              <Input
                id="bootstrap-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}

            <Button
              type="button"
              className="w-full"
              disabled={!canSubmit || isSubmitting}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? "Creating account…" : "Create administrator & sign in"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
