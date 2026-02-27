import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

/**
 * Google Trends Trending Now category name → numeric category ID
 *
 * These IDs are used as the `?category=N` URL query parameter on:
 *   https://trends.google.com/trending
 */
export const GT_CATEGORY_IDS: Record<string, number> = {
    "All categories": 0,
    "Autos and Vehicles": 1,
    "Beauty and Fashion": 2,
    "Business and Finance": 3,
    "Entertainment": 4,
    "Food and Drink": 5,
    "Games": 6,
    "Health": 7,
    "Hobbies and Leisure": 8,
    "Jobs and Education": 9,
    "Law and Government": 10,
    "Other": 11,
    "Pets and Animals": 13,
    "Politics": 14,
    "Science": 15,
    "Shopping": 16,
    "Sports": 17,
    "Technology": 18,
    "Travel and Transportation": 19,
    "Climate": 20,
};

/**
 * GET /api/trends/trending-now
 *
 * Scrapes real-time trending keywords from the Google Trends "Trending Now" page
 * via a headless Selenium session. Returns deduplicated keyword strings.
 *
 * Query parameters:
 *   geo       — ISO country code (default: "US"). E.g. "IN", "US", "GB"
 *   category  — GT Trending Now category ID (default: "0" = All categories)
 *               0  = All    1  = Autos    2  = Beauty    3  = Business
 *               4  = Entertainment        5  = Food & Drink
 *               6  = Games  7  = Health   8  = Hobbies   9  = Jobs
 *               10 = Law    11 = Other    13 = Pets       14 = Politics
 *               15 = Science 16 = Shopping 17 = Sports   18 = Technology
 *               19 = Travel  20 = Climate
 *   hours     — Time window: 4 | 24 | 48 | 168 (default: "168" = 7 days)
 *   limit     — Max keywords to return (default: 50, max: 100)
 *
 * Response:
 *   { keywords: string[], count: number, geo, category, category_name, hours }
 *
 * Example:
 *   GET /api/trends/trending-now?geo=IN&category=1&hours=168&limit=20
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const geo = (searchParams.get("geo") ?? "US").toUpperCase().trim();
        const category = (searchParams.get("category") ?? "0").trim();
        const hours = (searchParams.get("hours") ?? "168").trim();
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));

        // GT Trending Now only accepts these time windows
        const resolvedHours = ["4", "24", "48", "168"].includes(hours) ? hours : "168";

        const scriptPath = path.join(process.cwd(), "scraper", "trends_scraper.py");

        console.log(`[trends/trending-now] Request — geo=${geo}, category=${category}, hours=${resolvedHours}, limit=${limit}`);

        const result = await runPythonScraper({ scriptPath, geo, category, hours: resolvedHours, limit });

        console.log(`[trends/trending-now] Success — ${result.count} keyword(s) returned for "${result.category_name}" (${result.geo})`);

        return NextResponse.json(result);

    } catch (error: unknown) {
        console.error("[trends/trending-now] Unhandled error:", error);
        return NextResponse.json(
            { error: (error as Error).message ?? "Failed to fetch trending keywords", keywords: [], count: 0 },
            { status: 500 }
        );
    }
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface ScraperArgs {
    scriptPath: string;
    geo: string;
    category: string;
    hours: string;
    limit: number;
}

interface ScraperResult {
    keywords: string[];
    count: number;
    geo: string;
    category: string;
    category_name: string;
    hours: string;
    error?: string;
}

// ─── Helper: spawn Python scraper as a child process ───────────────────────

function runPythonScraper(args: ScraperArgs): Promise<ScraperResult> {
    return new Promise((resolve, reject) => {
        const pyArgs = [
            args.scriptPath,
            "--geo", args.geo,
            "--category", args.category,
            "--hours", args.hours,
            "--limit", String(args.limit),
        ];

        const proc = spawn("python", pyArgs, {
            timeout: 90_000, // 90s — allow extra time for slow connections
            env: { ...process.env },
        });

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
        proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

        proc.on("close", (code) => {
            // Emit scraper stderr (timestamped log lines) to server logs
            if (stderr.trim()) {
                stderr.trim().split("\n").forEach((line) => console.log(`  py> ${line}`));
            }

            if (code !== 0 && !stdout.trim()) {
                reject(new Error(`Python scraper exited with code ${code}. Check stderr above.`));
                return;
            }

            try {
                const parsed = JSON.parse(stdout.trim()) as ScraperResult;
                if (parsed.error && parsed.keywords.length === 0) {
                    console.warn("[trends/trending-now] Scraper returned an error:", parsed.error);
                }
                resolve(parsed);
            } catch (e) {
                console.error("[trends/trending-now] Failed to parse scraper stdout:", stdout.slice(0, 300));
                reject(new Error(`Failed to parse scraper output: ${String(e)}`));
            }
        });

        proc.on("error", (err) => {
            reject(new Error(
                `Failed to start Python scraper: ${err.message}. ` +
                `Ensure Python 3 is installed and accessible in PATH.`
            ));
        });
    });
}
