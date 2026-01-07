
import { NextRequest, NextResponse } from "next/server";
import { getPreliminaryResults } from "@/lib/step-function";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const keyword = searchParams.get("keyword");
        const searchMode = searchParams.get("search_mode") || "manual_search";
        const category = searchParams.get("category");

        const results = await getPreliminaryResults(keyword || undefined, searchMode, category || undefined);

        // BigInt is not JSON serializable, convert to Number/String
        const serialized = JSON.parse(JSON.stringify(results, (key, value) =>
            typeof value === 'bigint' ? Number(value) : value
        ));

        return NextResponse.json({
            success: true,
            count: serialized.length,
            results: serialized,
            isPreliminary: true
        });

    } catch (error: unknown) {
        console.error("Preliminary Results Error:", error);

        const s3Error = error as { name?: string; Code?: string; message?: string };
        // Return empty results instead of error if data not ready yet
        if (s3Error.name === 'NoSuchKey' || s3Error.Code === 'NoSuchKey') {
            return NextResponse.json({
                success: true,
                count: 0,
                results: [],
                isPreliminary: true,
                message: "Data not ready yet"
            });
        }

        return NextResponse.json(
            { error: s3Error.message || "Failed to fetch preliminary results" },
            { status: 500 }
        );
    }
}
