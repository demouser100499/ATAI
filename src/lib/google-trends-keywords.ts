/**
 * Fetches related search queries from Google Trends for a category/topic.
 * Used by category search to generate keywords from Google Trends data instead of Lambda.
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

/**
 * Parse relatedQueries JSON response from google-trends-api.
 * Response shape: { default: { rankedList: [ { rankedKeyword: [ { query: string, value, ... } ] }, ... ] } }
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
 * Get related search queries from Google Trends for a category/topic.
 * Used to generate keywords for category-based search from UI (Google Trends data).
 *
 * @param category - Category or topic (e.g. "Electronics & Tech", "Fashion")
 * @param geo - Geo code (e.g. "US", "GB")
 * @param options - Optional startTime, endTime, limit
 * @returns Array of unique keyword strings (up to limit)
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
    // If Google blocks or rate-limits us (HTML / redirect / captcha), or any other error occurs,
    // gracefully degrade by returning an empty list so callers can fall back (e.g. to the raw category name).
    return [];
  }
}
