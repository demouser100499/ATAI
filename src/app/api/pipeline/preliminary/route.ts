
import { NextRequest, NextResponse } from "next/server";
import { getPreliminaryResults } from "@/lib/step-function";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const keyword = searchParams.get("keyword");

        const results = await getPreliminaryResults(keyword || undefined);

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

    } catch (error: any) {
        console.error("Preliminary Results Error:", error);

        // Return empty results instead of error if data not ready yet
        if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
            return NextResponse.json({
                success: true,
                count: 0,
                results: [],
                isPreliminary: true,
                message: "Data not ready yet"
            });
        }

        return NextResponse.json(
            { error: error.message || "Failed to fetch preliminary results" },
            { status: 500 }
        );
    }
}
