"use client";

import Image from "next/image";

export type UserAvatarFields = {
  image?: string | null;
  username?: string | null;
  name?: string | null;
  email?: string | null;
};

export function getUserInitial(user: UserAvatarFields): string {
  const raw = (user.username ?? user.name ?? user.email ?? "?").trim();
  if (!raw.length) {
    return "?";
  }
  return raw.charAt(0).toUpperCase();
}

const sizePx = { sm: 24, md: 32 } as const;

export function UserAvatar({
  user,
  size = "sm",
  className = "",
}: {
  user: UserAvatarFields;
  size?: keyof typeof sizePx;
  className?: string;
}) {
  const px = sizePx[size];

  if (user.image) {
    return (
      <Image
        src={user.image}
        alt={user.name ?? user.username ?? "User"}
        width={px}
        height={px}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  const initial = getUserInitial(user);

  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-sky-200 font-semibold text-sky-900 ${size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm"} ${className}`}
      aria-hidden
    >
      {initial}
    </span>
  );
}
