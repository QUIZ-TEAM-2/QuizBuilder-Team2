import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import type { AuthProviderMaterializedConfig } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { SendGridOtp } from "./sendgridOtp";

const PASSWORD_PROVIDER_ID = "password";
const GOOGLE_PROVIDER_ID = "google";

/** User-facing copy; keep in sync with `formatPasswordAuthError` in `convex-sign-in.tsx`. */
const AUTH_MSG = {
  /** Email/password sign-up: email already in use (password-only or password+Google account). */
  emailExistsSignIn:
    "This email is already registered. Please sign in.",
  /** Email/password sign-up: account was created with Google (with or without password). */
  emailExistsGoogle:
    "This email is already registered. Please sign in with Google.",
  usernameTaken: "This username is already taken.",
  usernameRequired: "Username is required.",
  usernameLength:
    "Username must be between 2 and 32 characters.",
  usernameChars:
    "Username may only contain lowercase letters, numbers, and underscores.",
} as const;

function normalizeEmail(email: string | undefined): string | undefined {
  if (email === undefined || typeof email !== "string") {
    return undefined;
  }
  const t = email.trim().toLowerCase();
  return t.length > 0 ? t : undefined;
}

/** Normalized handle: lowercase, trimmed; used for storage and uniqueness. */
function normalizeUsername(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const t = raw.trim().toLowerCase();
  return t.length > 0 ? t : undefined;
}

/** When the user registered with a handle, OAuth must not overwrite `name` (or that handle). */
function stripOAuthNameIfUserHasUsername(
  existing: Doc<"users">,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing.username) {
    return patch;
  }
  const { name: _dropName, username: _dropUsername, ...rest } = patch;
  return rest;
}

function buildUserPatch(args: {
  provider: AuthProviderMaterializedConfig;
  profile: Record<string, unknown> & {
    email?: string;
    phone?: string;
    emailVerified?: boolean;
    phoneVerified?: boolean;
  };
}) {
  const {
    provider,
    profile: {
      emailVerified: profileEmailVerified,
      phoneVerified: profilePhoneVerified,
      role: _omitRoleFromProfile,
      ...profileRest
    },
  } = args;
  const emailVerified =
    profileEmailVerified ??
    ((provider.type === "oauth" || provider.type === "oidc") &&
      provider.allowDangerousEmailAccountLinking !== false);
  const phoneVerified = profilePhoneVerified ?? false;
  return {
    ...(emailVerified ? { emailVerificationTime: Date.now() } : {}),
    ...(phoneVerified ? { phoneVerificationTime: Date.now() } : {}),
    ...profileRest,
  };
}

/** All users whose email matches (normalized). Uses `.collect()` — never `.unique()`. */
async function findAllUsersByNormalizedEmail(
  ctx: MutationCtx,
  normalizedEmail: string,
): Promise<Doc<"users">[]> {
  const byIndex = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", normalizedEmail))
    .collect();
  if (byIndex.length > 0) {
    return byIndex;
  }
  const all = await ctx.db.query("users").collect();
  return all.filter(
    (u) => u.email !== undefined && normalizeEmail(u.email) === normalizedEmail,
  );
}

/**
 * When multiple `users` rows share the same email (historical duplicates), pick one
 * to attach new OAuth/password credentials: Google > password > oldest `_creationTime`.
 */
async function pickCanonicalUser(
  ctx: MutationCtx,
  users: Doc<"users">[],
): Promise<Doc<"users">> {
  if (users.length === 1) {
    return users[0]!;
  }
  const scored = await Promise.all(
    users.map(async (u) => ({
      u,
      hasGoogle: await userHasProvider(ctx, u._id, GOOGLE_PROVIDER_ID),
      hasPassword: await userHasProvider(ctx, u._id, PASSWORD_PROVIDER_ID),
    })),
  );
  const withGoogle = scored.find((s) => s.hasGoogle);
  if (withGoogle) {
    return withGoogle.u;
  }
  const withPassword = scored.find((s) => s.hasPassword);
  if (withPassword) {
    return withPassword.u;
  }
  return [...users].sort((a, b) => a._creationTime - b._creationTime)[0]!;
}

async function resolveUserByNormalizedEmail(
  ctx: MutationCtx,
  normalizedEmail: string,
): Promise<Doc<"users"> | null> {
  const all = await findAllUsersByNormalizedEmail(ctx, normalizedEmail);
  if (all.length === 0) {
    return null;
  }
  return await pickCanonicalUser(ctx, all);
}

async function userHasProvider(
  ctx: MutationCtx,
  userId: Id<"users">,
  provider: string,
): Promise<boolean> {
  const rows = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", provider),
    )
    .take(1);
  return rows.length > 0;
}

/**
 * If the user registered with email/password before Google (or only has password so far),
 * we keep the default avatar (no `image`) instead of applying Google's picture.
 */
async function preferPasswordFirstAvatar(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const passwordAccounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", PASSWORD_PROVIDER_ID),
    )
    .collect();
  if (passwordAccounts.length === 0) {
    return false;
  }
  const googleAccounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", GOOGLE_PROVIDER_ID),
    )
    .collect();
  if (googleAccounts.length === 0) {
    return true;
  }
  const passwordAt = Math.min(...passwordAccounts.map((a) => a._creationTime));
  const googleAt = Math.min(...googleAccounts.map((a) => a._creationTime));
  return passwordAt < googleAt;
}

async function stripGoogleImageIfPasswordFirst(
  ctx: MutationCtx,
  userId: Id<"users">,
  provider: AuthProviderMaterializedConfig,
  userData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (provider.type !== "oauth" && provider.type !== "oidc") {
    return userData;
  }
  if (provider.id !== GOOGLE_PROVIDER_ID) {
    return userData;
  }
  if (!(await preferPasswordFirstAvatar(ctx, userId))) {
    return userData;
  }
  const { image: _drop, ...rest } = userData;
  return { ...rest, image: undefined };
}

async function isUsernameTaken(
  ctx: MutationCtx,
  username: string,
  exceptUserId?: Id<"users">,
): Promise<boolean> {
  const row = await ctx.db
    .query("users")
    .withIndex("username", (q) => q.eq("username", username))
    .first();
  if (row === null) {
    return false;
  }
  if (exceptUserId !== undefined && row._id === exceptUserId) {
    return false;
  }
  return true;
}

async function uniqueUserWithVerifiedEmail(ctx: MutationCtx, email: string) {
  const users = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .filter((q) => q.neq(q.field("emailVerificationTime"), undefined))
    .take(2);
  return users.length === 1 ? users[0]! : null;
}

async function uniqueUserWithVerifiedPhone(ctx: MutationCtx, phone: string) {
  const users = await ctx.db
    .query("users")
    .withIndex("phone", (q) => q.eq("phone", phone))
    .filter((q) => q.neq(q.field("phoneVerificationTime"), undefined))
    .take(2);
  return users.length === 1 ? users[0]! : null;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      verify: SendGridOtp,
      profile: ((params: Record<string, unknown>) => {
        const email = normalizeEmail(params.email as string | undefined) ?? "";
        const flow = params.flow as string | undefined;
        if (flow === "signUp") {
          const handle = normalizeUsername(params.username);
          if (!handle) {
            throw new ConvexError(AUTH_MSG.usernameRequired);
          }
          if (handle.length < 2 || handle.length > 32) {
            throw new ConvexError(AUTH_MSG.usernameLength);
          }
          if (!/^[a-z0-9_]+$/.test(handle)) {
            throw new ConvexError(AUTH_MSG.usernameChars);
          }
          return {
            email,
            username: handle,
            name: handle,
          };
        }
        return { email };
      }) as any,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: normalizeEmail(profile.email),
          image: profile.picture,
          // Treat missing email_verified as true so users get emailVerificationTime;
          // explicit false is rare (e.g. Workspace policy).
          emailVerified: profile.email_verified !== false,
        };
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const { existingUserId, provider, profile: rawProfile, type } = args;

      const normalizedEmail = normalizeEmail(rawProfile.email);
      const profile =
        normalizedEmail !== undefined
          ? { ...rawProfile, email: normalizedEmail }
          : { ...rawProfile };

      if (existingUserId) {
        const existingDoc = await ctx.db.get(existingUserId);
        let userData = buildUserPatch({ provider, profile }) as Record<
          string,
          unknown
        >;
        if (existingDoc) {
          userData = stripOAuthNameIfUserHasUsername(existingDoc, userData);
          userData = await stripGoogleImageIfPasswordFirst(
            ctx,
            existingUserId,
            provider,
            userData,
          );
        }
        await ctx.db.patch(existingUserId, userData);
        return existingUserId;
      }

      // --- OAuth / OIDC: merge into existing user by email (e.g. password account then Google — OK). ---
      if (provider.type === "oauth" || provider.type === "oidc") {
        if (normalizedEmail) {
          const existing = await resolveUserByNormalizedEmail(
            ctx,
            normalizedEmail,
          );
          if (existing) {
            // Link Google to existing user (password-only, Google-only, or both — same email).
            let userData = buildUserPatch({ provider, profile }) as Record<
              string,
              unknown
            >;
            userData = stripOAuthNameIfUserHasUsername(existing, userData);
            userData = await stripGoogleImageIfPasswordFirst(
              ctx,
              existing._id,
              provider,
              userData,
            );
            await ctx.db.patch(existing._id, userData);
            return existing._id;
          }
        }
        const userData = buildUserPatch({ provider, profile });
        return await ctx.db.insert("users", userData);
      }

      // --- Email/password sign-up only: never merge — duplicate email or username must error. ---
      if (type === "credentials") {
        if (normalizedEmail) {
          const existing = await resolveUserByNormalizedEmail(
            ctx,
            normalizedEmail,
          );
          if (existing) {
            const hasGoogle = await userHasProvider(
              ctx,
              existing._id,
              GOOGLE_PROVIDER_ID,
            );
            if (hasGoogle) {
              throw new ConvexError(AUTH_MSG.emailExistsGoogle);
            }
            throw new ConvexError(AUTH_MSG.emailExistsSignIn);
          }
        }
        const signUpUsername =
          typeof profile.username === "string" ? profile.username : undefined;
        if (signUpUsername !== undefined && (await isUsernameTaken(ctx, signUpUsername))) {
          throw new ConvexError(AUTH_MSG.usernameTaken);
        }
        const userData = buildUserPatch({ provider, profile });
        return await ctx.db.insert("users", userData);
      }

      // --- Magic link / phone / verification flows (match Convex Auth defaults). ---
      // `provider` is narrowed here — OAuth and password are handled above.
      const emailVerified = profile.emailVerified ?? provider.type === "email";
      const phoneVerified = profile.phoneVerified ?? provider.type === "phone";
      const linkFlags = args as {
        shouldLinkViaEmail?: boolean;
        shouldLinkViaPhone?: boolean;
      };
      const shouldLinkViaEmail =
        linkFlags.shouldLinkViaEmail ||
        emailVerified ||
        provider.type === "email";
      const shouldLinkViaPhone =
        linkFlags.shouldLinkViaPhone ||
        phoneVerified ||
        provider.type === "phone";

      let userId: Id<"users"> | null = null;

      const existingUserWithVerifiedEmailId =
        typeof profile.email === "string" && shouldLinkViaEmail
          ? (await uniqueUserWithVerifiedEmail(ctx, profile.email))?._id ?? null
          : null;

      const existingUserWithVerifiedPhoneId =
        typeof profile.phone === "string" && shouldLinkViaPhone
          ? (await uniqueUserWithVerifiedPhone(ctx, profile.phone))?._id ?? null
          : null;

      if (
        existingUserWithVerifiedEmailId !== null &&
        existingUserWithVerifiedPhoneId !== null
      ) {
        userId = null;
      } else if (existingUserWithVerifiedEmailId !== null) {
        userId = existingUserWithVerifiedEmailId;
      } else if (existingUserWithVerifiedPhoneId !== null) {
        userId = existingUserWithVerifiedPhoneId;
      }

      const userData = buildUserPatch({ provider, profile });

      if (userId !== null) {
        await ctx.db.patch(userId, userData);
        return userId;
      }
      return await ctx.db.insert("users", userData);
    },
  },
});

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});
