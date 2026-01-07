
import { NextRequest, NextResponse } from "next/server";
import { startPipelineExecution } from "@/lib/step-function";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { keyword, filters, search_mode } = body;
        const category = filters?.category;

        if (!keyword && !category) {
            return NextResponse.json(
                { error: "Keyword or Category is required" },
                { status: 400 }
            );
        }

        console.log(`Triggering pipeline for ${keyword ? `keyword: ${keyword}` : `category: ${category}`} with filters:`, filters, `mode: ${search_mode}`);
        console.log(`Filters:`, filters);
        const result = await startPipelineExecution(keyword, filters, search_mode);

        return NextResponse.json({
            success: result.status !== 'FAILED',
            executionArn: result.executionArn,
            message: result.message
        });

    } catch (error: unknown) {
        console.error("Pipeline Trigger Error:", error);
        return NextResponse.json(
            { error: (error as Error).message || "Failed to start pipeline" },
            { status: 500 }
        );
    }
}
