import { NextRequest, NextResponse } from "next/server";
import { discoverCategoryKeywords } from "@/lib/category-keywords";
import { getRelatedQueriesForCategory } from "@/lib/google-trends-keywords";

/**
 * GET /api/trends/related-queries?category=...&geo=...&limit=...&trendPeriod=...
 * Returns keywords for a category: SerpAPI discovery (seeds + autocomplete + shopping) first,
 * then Google Trends related queries. Does not trigger any pipeline.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category")?.trim() ?? "";
    const geo = searchParams.get("geo")?.trim() ?? "";
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const trendPeriodMonths = Math.min(60, Math.max(1, parseInt(searchParams.get("trendPeriod") ?? "12", 10) || 12));

    if (!category) {
      return NextResponse.json(
        { error: "category is required" },
        { status: 400 }
      );
    }

    let keywords = await discoverCategoryKeywords(category, geo, { limit, maxSeeds: 5 });
    if (keywords.length === 0) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - trendPeriodMonths);
      keywords = await getRelatedQueriesForCategory(category, geo, {
        startTime: startDate,
        endTime: endDate,
        limit,
      });
    }

    console.log("Related queries for category", category, "geo", geo, "limit", limit, "count", keywords.length);
    return NextResponse.json({ keywords });
  } catch (error) {
    console.error("Related queries API error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to fetch related queries" },
      { status: 500 }
    );
  }
}
