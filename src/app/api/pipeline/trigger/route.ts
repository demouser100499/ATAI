
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
        const executionArn = await startPipelineExecution(keyword, filters, search_mode);

        return NextResponse.json({
            success: true,
            executionArn,
            message: "Pipeline started successfully"
        });
    }catch (error: any) {
        console.error("Pipeline Trigger Error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error.message || "Pipeline triggered with warnings",
            },
            {
                status: 200, // 🔥 IMPORTANT: NOT 500
            }
        );
    }

    // } catch (error: any) {
    //     console.error("Pipeline Trigger Error:", error);
    //     return NextResponse.json(
    //         { error: error.message || "Failed to start pipeline" },
    //         { status: 500 }
    //     );
    // }
}
