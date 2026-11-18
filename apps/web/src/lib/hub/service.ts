import { and, asc, desc, eq, or } from "drizzle-orm";
import type {
  CreateCustomSiteInput,
  HubListResponse,
  HubSiteItem,
  SiteCategory,
  UpdateSitePatchInput,
} from "@omnikit/shared";
import { getReadyDb } from "../db/client";
import { siteBookmarks, siteFavorites } from "../db/schema";
import {
  buildCustomSiteSlug,
  extractDomain,
  normalizeExternalHttpUrl,
} from "../http/safe-url";

export interface HubQueryFilter {
  clientId: string;
  query?: string;
  category?: SiteCategory | "all";
  officialOnly?: boolean;
  favoritesOnly?: boolean;
}

/**
 * 查询当前工作区可见的网址导航列表（合并系统预置网站与当前用户自定义网站）
 * 收藏项自动置顶排列，其次按 sortOrder 与创建时间排序。
 */
export async function listHubSites(
  filter: HubQueryFilter
): Promise<HubListResponse> {
  const { db } = await getReadyDb();

  const [rows, favRows] = await Promise.all([
    db
      .select()
      .from(siteBookmarks)
      .where(
        or(
          eq(siteBookmarks.ownerClientId, "system"),
          eq(siteBookmarks.ownerClientId, filter.clientId)
        )
      )
      .orderBy(asc(siteBookmarks.sortOrder), desc(siteBookmarks.createdAt)),
    db
      .select({ siteId: siteFavorites.siteId })
      .from(siteFavorites)
      .where(eq(siteFavorites.clientId, filter.clientId)),
  ]);

  const favSet = new Set(favRows.map((f) => f.siteId));

  const allMapped: HubSiteItem[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    url: r.url,
    domain: r.domain,
    category: r.category as SiteCategory,
    description: r.description,
    tags: Array.isArray(r.tags) ? r.tags : [],
    isOfficial: r.isOfficial,
    isBuiltin: r.isBuiltin,
    isFavorite: favSet.has(r.id),
    verifiedNote: r.verifiedNote ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  const stats = {
    totalCount: allMapped.length,
    builtinCount: allMapped.filter((x) => x.isBuiltin).length,
    customCount: allMapped.filter((x) => !x.isBuiltin).length,
    favoriteCount: allMapped.filter((x) => x.isFavorite).length,
  };

  const keyword = (filter.query || "").trim().toLowerCase();

  const filtered = allMapped
    .filter((item) => {
      if (
        filter.category &&
        filter.category !== "all" &&
        item.category !== filter.category
      ) {
        return false;
      }
      if (filter.officialOnly && !item.isOfficial) {
        return false;
      }
      if (filter.favoritesOnly && !item.isFavorite) {
        return false;
      }
      if (keyword) {
        const haystack = [
          item.name,
          item.domain,
          item.description,
          ...item.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(keyword)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) {
        return a.isFavorite ? -1 : 1;
      }
      if (a.isBuiltin !== b.isBuiltin) {
        return a.isBuiltin ? 1 : -1; // 用户新建站点在未收藏同级中优先靠前以便确认
      }
      return 0;
    });

  return { items: filtered, stats };
}

/**
 * 创建用户自定义网址条目
 */
export async function createCustomSite(
  clientId: string,
  input: CreateCustomSiteInput
): Promise<HubSiteItem> {
  const { db } = await getReadyDb();
  const normalizedUrl = normalizeExternalHttpUrl(input.url);
  const domain = extractDomain(normalizedUrl);
  const slug = buildCustomSiteSlug(input.name);

  const [inserted] = await db
    .insert(siteBookmarks)
    .values({
      ownerClientId: clientId,
      slug,
      name: input.name.trim(),
      url: normalizedUrl,
      domain,
      category: input.category,
      description: input.description.trim(),
      tags: input.tags,
      isOfficial: false,
      isBuiltin: false,
      verifiedNote: "用户自定义添加条目",
      sortOrder: 50,
    })
    .returning();

  if (!inserted) {
    throw new Error("保存自定义网址失败");
  }

  return {
    id: inserted.id,
    slug: inserted.slug,
    name: inserted.name,
    url: inserted.url,
    domain: inserted.domain,
    category: inserted.category as SiteCategory,
    description: inserted.description,
    tags: inserted.tags,
    isOfficial: inserted.isOfficial,
    isBuiltin: inserted.isBuiltin,
    isFavorite: false,
    verifiedNote: inserted.verifiedNote,
    createdAt: inserted.createdAt.toISOString(),
  };
}

export class HubServiceError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN_OPERATION",
    message: string
  ) {
    super(message);
  }
}

/**
 * 更新站点收藏状态或编辑用户自定义站点属性
 * 注意：内置站点允许任意用户收藏/取消收藏，但不允许篡改内置站点的名称和链接。
 */
export async function updateSiteForClient(
  clientId: string,
  siteId: string,
  patch: UpdateSitePatchInput
): Promise<HubSiteItem> {
  const { db } = await getReadyDb();

  const [target] = await db
    .select()
    .from(siteBookmarks)
    .where(
      and(
        eq(siteBookmarks.id, siteId),
        or(
          eq(siteBookmarks.ownerClientId, "system"),
          eq(siteBookmarks.ownerClientId, clientId)
        )
      )
    );

  if (!target) {
    throw new HubServiceError("NOT_FOUND", "未找到指定的网站条目");
  }

  const wantsMetadataEdit =
    patch.name !== undefined ||
    patch.url !== undefined ||
    patch.category !== undefined ||
    patch.description !== undefined ||
    patch.tags !== undefined;

  if (wantsMetadataEdit && (target.isBuiltin || target.ownerClientId !== clientId)) {
    throw new HubServiceError(
      "FORBIDDEN_OPERATION",
      "系统预置官方站点不允许修改基础信息，仅支持收藏操作"
    );
  }

  let currentRecord = target;

  if (wantsMetadataEdit) {
    const nextUrl = patch.url
      ? normalizeExternalHttpUrl(patch.url)
      : target.url;
    const nextDomain = patch.url ? extractDomain(nextUrl) : target.domain;

    const [updated] = await db
      .update(siteBookmarks)
      .set({
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.url !== undefined ? { url: nextUrl, domain: nextDomain } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description.trim() }
          : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        updatedAt: new Date(),
      })
      .where(eq(siteBookmarks.id, siteId))
      .returning();

    if (updated) {
      currentRecord = updated;
    }
  }

  if (patch.isFavorite !== undefined) {
    if (patch.isFavorite) {
      await db
        .insert(siteFavorites)
        .values({ clientId, siteId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(siteFavorites)
        .where(
          and(
            eq(siteFavorites.clientId, clientId),
            eq(siteFavorites.siteId, siteId)
          )
        );
    }
  }

  const [favRow] = await db
    .select({ id: siteFavorites.id })
    .from(siteFavorites)
    .where(
      and(
        eq(siteFavorites.clientId, clientId),
        eq(siteFavorites.siteId, siteId)
      )
    );

  return {
    id: currentRecord.id,
    slug: currentRecord.slug,
    name: currentRecord.name,
    url: currentRecord.url,
    domain: currentRecord.domain,
    category: currentRecord.category as SiteCategory,
    description: currentRecord.description,
    tags: Array.isArray(currentRecord.tags) ? currentRecord.tags : [],
    isOfficial: currentRecord.isOfficial,
    isBuiltin: currentRecord.isBuiltin,
    isFavorite: Boolean(favRow),
    verifiedNote: currentRecord.verifiedNote,
    createdAt: currentRecord.createdAt.toISOString(),
  };
}

/**
 * 删除用户自己创建的自定义网址
 */
export async function deleteCustomSite(
  clientId: string,
  siteId: string
): Promise<{ deletedId: string }> {
  const { db } = await getReadyDb();

  const [target] = await db
    .select()
    .from(siteBookmarks)
    .where(eq(siteBookmarks.id, siteId));

  if (!target) {
    throw new HubServiceError("NOT_FOUND", "目标网站条目不存在");
  }
  if (target.isBuiltin || target.ownerClientId !== clientId) {
    throw new HubServiceError(
      "FORBIDDEN_OPERATION",
      "系统预置官方站点受保护，不可删除"
    );
  }

  await db.delete(siteBookmarks).where(eq(siteBookmarks.id, siteId));
  return { deletedId: siteId };
}

/**
 * 批量导入自定义网址（按相同 URL 自动去重）
 */
export async function importCustomSites(
  clientId: string,
  items: CreateCustomSiteInput[]
): Promise<{ importedCount: number; skippedCount: number }> {
  const { db } = await getReadyDb();
  const existing = await db
    .select({ url: siteBookmarks.url })
    .from(siteBookmarks)
    .where(eq(siteBookmarks.ownerClientId, clientId));

  const seenUrls = new Set(existing.map((e) => e.url.toLowerCase()));
  let importedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    const normalizedUrl = normalizeExternalHttpUrl(item.url);
    if (seenUrls.has(normalizedUrl.toLowerCase())) {
      skippedCount += 1;
      continue;
    }
    seenUrls.add(normalizedUrl.toLowerCase());
    await createCustomSite(clientId, { ...item, url: normalizedUrl });
    importedCount += 1;
  }

  return { importedCount, skippedCount };
}
