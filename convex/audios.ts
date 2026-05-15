import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

async function requireUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

export const getUserAudios = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const audios = await ctx.db
      .query("audios")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return await Promise.all(
      audios
        .filter((audio) => audio.hiddenFromPicker !== true)
        .map(async (audio) => ({
          ...audio,
          url: await ctx.storage.getUrl(audio.storageId),
        })),
    );
  },
});

export const saveAudio = mutation({
  args: {
    name: v.string(),
    storageId: v.id("_storage"),
    format: v.optional(v.string()),
    size: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const audioId = await ctx.db.insert("audios", {
      name: args.name,
      userId,
      storageId: args.storageId,
      format: args.format,
      size: args.size,
    });

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error("Failed to generate audio URL");
    }

    return {
      audioId,
      storageId: args.storageId,
      url,
    };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const deleteAudio = mutation({
  args: { audioId: v.id("audios") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const audio = await ctx.db.get(args.audioId);
    if (!audio || audio.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.audioId, { hiddenFromPicker: true });

    return { success: true };
  },
});
