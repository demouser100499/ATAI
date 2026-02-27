/**
 * Category keyword discovery using curated seeds + SerpAPI (autocomplete + shopping).
 * Produces diverse, product-intent keywords for Amazon/Alibaba pipeline.
 * Falls back to Google Trends relatedQueries when SerpAPI is not configured or category has no seeds.
 */

import { CATEGORY_SEEDS, DASHBOARD_CATEGORY_TO_SEEDS_KEY } from "./category-seeds";
import { serpapiAutocomplete, serpapiShopping, isSerpApiConfigured } from "./serpapi";

const DEFAULT_MAX_SEEDS = 5;
const MIN_KEYWORD_LENGTH = 3;
const MAX_KEYWORD_LENGTH = 80;
const DELAY_MS = 250;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve dashboard PRODUCT CATEGORY value to a CATEGORY_SEEDS key (or empty if no seeds).
 */
export function resolveCategoryToSeedsKey(dashboardCategory: string): string {
  if (!dashboardCategory || dashboardCategory === "All categories") return "";
  const key = DASHBOARD_CATEGORY_TO_SEEDS_KEY[dashboardCategory];
  if (!key) return "";
  return CATEGORY_SEEDS[key] ? key : "";
}

/**
 * Discover keywords for a category using SerpAPI (autocomplete + shopping) with curated seeds.
 * Returns empty array if SERPAPI_KEY is not set, category has no seeds, or on error.
 */
export async function discoverCategoryKeywords(
  category: string,
  geo: string,
  options: { limit?: number; maxSeeds?: number } = {}
): Promise<string[]> {
  const { limit = 50, maxSeeds = DEFAULT_MAX_SEEDS } = options;

  if (!isSerpApiConfigured()) return [];

  const seedsKey = resolveCategoryToSeedsKey(category);
  if (!seedsKey) return [];

  const seeds = CATEGORY_SEEDS[seedsKey];
  if (!seeds || seeds.length === 0) return [];

  const numSeeds = Math.min(maxSeeds, seeds.length);
  const shuffled = [...seeds].sort(() => Math.random() - 0.5);
  const selectedSeeds = shuffled.slice(0, numSeeds);

  const allKeywords = new Set<string>();
  const gl = geo?.trim() || "US";

  for (const seed of selectedSeeds) {
    try {
      const [autocompleteKws, shoppingKws] = await Promise.all([
        serpapiAutocomplete(seed, gl),
        serpapiShopping(seed, gl),
      ]);
      autocompleteKws.forEach((k) => allKeywords.add(k));
      shoppingKws.forEach((k) => allKeywords.add(k));
      await delay(DELAY_MS);
    } catch (e) {
      console.error("[discoverCategoryKeywords] Error for seed:", seed, e);
    }
  }

  const cleaned = [...allKeywords].filter(
    (k) =>
      typeof k === "string" &&
      k.length >= MIN_KEYWORD_LENGTH &&
      k.length <= MAX_KEYWORD_LENGTH &&
      !k.includes("?")
  );

  return cleaned.slice(0, limit);
}
