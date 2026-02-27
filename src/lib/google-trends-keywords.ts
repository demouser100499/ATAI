/**
 * Fetches trending keywords from Google Trends for a category/topic.
 * Priority:
 *   1. realTimeTrends  — topics trending right now (last 24h), filtered by category
 *   2. dailyTrends     — top daily searches, keyword-title extracted
 *   3. relatedQueries  — related search queries for the category term (original fallback)
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const googleTrends = require("google-trends-api");

export interface GetRelatedQueriesOptions {
  /** Start of time period (default: trend_window_months ago) */
  startTime?: Date;
  /** End of time period (default: now) */
  endTime?: Date;
  /** Max number of keywords to return (default: 50) */
  limit?: number;
}

// ─── Google Trends category code mapping ─────────────────────────────────────
// Maps dashboard "PRODUCT CATEGORY" labels to Google Trends realTimeTrends `cat` values.
// Supported realTimeTrends cats: 'all', 'b' (Business), 'e' (Entertainment), 
// 'm' (Health), 't' (Sci/Tech), 's' (Sports), 'h' (Top Stories).
const CATEGORY_TO_GT_CAT: Record<string, string> = {
  "All categories": "all",
  "Arts & Entertainment": "e",
  "Autos & Vehicles": "all",
  "Beauty & Fitness": "m",
  "Books & Literature": "e",
  "Business & Industrial": "b",
  "Computers & Electronics": "t",
  "Finance": "b",
  "Food & Drink": "m",
  "Games": "e",
  "Health": "m",
  "Hobbies & Leisure": "e",
  "Home & Garden": "all",
  "Internet & Telecom": "t",
  "Jobs & Education": "all",
  "Law & Government": "b",
  "News": "h",
  "People & Society": "all",
  "Pets & Animals": "all",
  "Real Estate": "b",
  "Science": "t",
  "Shopping": "all",
  "Sports": "s",
  "Travel": "all",
};

/**
 * Parse relatedQueries JSON response from google-trends-api.
 */
function parseRelatedQueriesResponse(jsonStr: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  try {
    const data = JSON.parse(jsonStr) as {
      default?: {
        rankedList?: Array<{
          rankedKeyword?: Array<{ query?: string }>;
        }>;
      };
    };

    const rankedList = data?.default?.rankedList ?? [];
    for (const list of rankedList) {
      const items = list?.rankedKeyword ?? [];
      for (const item of items) {
        const q = typeof item?.query === "string" ? item.query.trim() : "";
        if (q && !seen.has(q.toLowerCase())) {
          seen.add(q.toLowerCase());
          keywords.push(q);
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse Google Trends relatedQueries response:", e);
  }

  return keywords;
}

/**
 * Parse realTimeTrends JSON coming from google-trends-api.
 * Shape: { storySummaries: { trendingStories: [{ entityNames, title, articles: [{articleTitle}] }] } }
 * We extract entityNames + titles as candidate keyword strings.
 */
function parseRealTimeTrendsResponse(jsonStr: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  function addKw(raw: string) {
    const kw = raw?.trim();
    if (kw && kw.length >= 3 && kw.length <= 80 && !seen.has(kw.toLowerCase())) {
      seen.add(kw.toLowerCase());
      keywords.push(kw);
    }
  }

  try {
    const data = JSON.parse(jsonStr) as {
      storySummaries?: {
        trendingStories?: Array<{
          entityNames?: string[];
          title?: string;
          articles?: Array<{ articleTitle?: string }>;
        }>;
      };
    };

    const stories = data?.storySummaries?.trendingStories ?? [];
    for (const story of stories) {
      // Add all entity names (often product/brand names)
      for (const name of story.entityNames ?? []) addKw(name);
      // Add the headline title
      if (story.title) addKw(story.title);
    }
  } catch (e) {
    console.error("Failed to parse Google Trends realTimeTrends response:", e);
  }

  return keywords;
}

/**
 * Parse dailyTrends JSON coming from google-trends-api.
 * Shape: { default: { trendingSearchesDays: [{ trendingSearches: [{ title: {query}, relatedQueries: [{query}] }] }] } }
 */
function parseDailyTrendsResponse(jsonStr: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  function addKw(raw: string) {
    const kw = raw?.trim();
    if (kw && kw.length >= 3 && kw.length <= 80 && !seen.has(kw.toLowerCase())) {
      seen.add(kw.toLowerCase());
      keywords.push(kw);
    }
  }

  try {
    const data = JSON.parse(jsonStr) as {
      default?: {
        trendingSearchesDays?: Array<{
          trendingSearches?: Array<{
            title?: { query?: string };
            relatedQueries?: Array<{ query?: string }>;
          }>;
        }>;
      };
    };

    const days = data?.default?.trendingSearchesDays ?? [];
    for (const day of days) {
      for (const search of day.trendingSearches ?? []) {
        if (search.title?.query) addKw(search.title.query);
        for (const rq of search.relatedQueries ?? []) {
          if (rq.query) addKw(rq.query);
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse Google Trends dailyTrends response:", e);
  }

  return keywords;
}

/**
 * Fetch real-time trending keywords from Google Trends (last 24h) for a dashboard category.
 * entityNames + story titles are returned as keywords.
 *
 * @param category - Dashboard category label (e.g. "Computers & Electronics")
 * @param geo      - Geo code (e.g. "US", "GB")
 * @param limit    - Max keywords to return
 */
export async function getRealtimeTrendingKeywords(
  category: string,
  geo: string,
  limit = 50
): Promise<string[]> {
  const cat = CATEGORY_TO_GT_CAT[category] ?? "all";
  const resolvedGeo = geo?.trim() || "US";

  try {
    const result = await googleTrends.realTimeTrends({
      geo: resolvedGeo,
      category: cat,
      hl: "en-US",
    });

    const keywords = parseRealTimeTrendsResponse(result);
    console.log(`[Trends realTimeTrends] category="${category}" cat="${cat}" geo="${resolvedGeo}" → ${keywords.length} keywords`);
    return keywords.slice(0, limit);
  } catch (err) {
    console.error("Google Trends realTimeTrends error:", category, err);
    return [];
  }
}

/**
 * Fetch daily trending searches from Google Trends for a geo.
 * Returns titles + relatedQueries from the most recent trending day.
 *
 * @param geo   - Geo code (e.g. "US", "GB")
 * @param limit - Max keywords to return
 */
export async function getDailyTrendingKeywords(
  geo: string,
  limit = 50
): Promise<string[]> {
  const resolvedGeo = geo?.trim() || "US";

  try {
    const today = new Date();
    const result = await googleTrends.dailyTrends({
      trendDate: today,
      geo: resolvedGeo,
      hl: "en-US",
    });

    const keywords = parseDailyTrendsResponse(result);
    console.log(`[Trends dailyTrends] geo="${resolvedGeo}" → ${keywords.length} keywords`);
    return keywords.slice(0, limit);
  } catch (err) {
    console.error("Google Trends dailyTrends error:", err);
    return [];
  }
}

/**
 * Get related search queries from Google Trends for a category/topic (original fallback).
 *
 * @param category - Category or topic (e.g. "Electronics & Tech", "Fashion")
 * @param geo      - Geo code (e.g. "US", "GB")
 * @param options  - Optional startTime, endTime, limit
 */
export async function getRelatedQueriesForCategory(
  category: string,
  geo: string,
  options: GetRelatedQueriesOptions = {}
): Promise<string[]> {
  const { startTime, endTime, limit = 50 } = options;

  const endDate = endTime ?? new Date();
  const startDate = startTime ?? (() => {
    const d = new Date(endDate);
    d.setMonth(d.getMonth() - 12);
    return d;
  })();

  try {
    const result = await googleTrends.relatedQueries({
      keyword: category,
      startTime: startDate,
      endTime: endDate,
      geo: geo || undefined,
    });

    const keywords = parseRelatedQueriesResponse(result);
    return keywords.slice(0, limit);
  } catch (err) {
    console.error("Google Trends relatedQueries error for category:", category, err);
    return [];
  }
}
