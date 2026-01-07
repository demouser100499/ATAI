import { NextRequest, NextResponse } from "next/server";
import { stopPipelineExecution } from "@/lib/step-function";

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const arn = searchParams.get("arn");
        console.log("Stop Pipeline Request Body:", arn);

        if (!arn) {
            return NextResponse.json({ error: "Execution ARN is required" }, { status: 400 });
        }

        const stopDate = await stopPipelineExecution(arn);

        return NextResponse.json({
            success: true,
            stopDate
        });
    } catch (error: unknown) {
        console.error("Stop Pipeline Error:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
