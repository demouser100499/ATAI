import { NextRequest, NextResponse } from "next/server";
import { fetchKeywordsFromPlanner } from "@/lib/step-function";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { category, geo, limit, search_volume_min, search_volume_max } = body;

        if (!category) {
            return NextResponse.json(
                { error: "Category is required" },
                { status: 400 }
            );
        }

        const keywords = await fetchKeywordsFromPlanner(
            category,
            geo || "US",
            limit || 50,
            search_volume_min,
            search_volume_max
        );

        return NextResponse.json({
            success: true,
            keywords: keywords.length > 0 ? keywords : [category]
        });

    } catch (error: unknown) {
        console.error("Generate Keywords API Error:", error);
        return NextResponse.json(
            { error: (error as Error).message || "Failed to generate keywords" },
            { status: 500 }
        );
    }
}
