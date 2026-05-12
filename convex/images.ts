import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
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

export const getUserImages = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const images = await ctx.db
      .query("images")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Get URLs for each image
    return await Promise.all(
      images
        .filter((image) => image.hiddenFromPicker !== true)
        .map(async (image) => ({
          ...image,
          url: await ctx.storage.getUrl(image.storageId),
        })),
    );
  },
});

export const saveImage = mutation({
  args: {
    name: v.string(),
    storageId: v.id("_storage"),
    format: v.optional(v.string()),
    size: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const imageId = await ctx.db.insert("images", {
      name: args.name,
      userId,
      storageId: args.storageId,
      format: args.format,
      size: args.size,
    });

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error("Failed to generate image URL");
    }

    return {
      imageId,
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

export const deleteImage = mutation({
  args: { imageId: v.id("images") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const image = await ctx.db.get(args.imageId);
    if (!image || image.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.imageId, { hiddenFromPicker: true });

    return { success: true };
  },
});
