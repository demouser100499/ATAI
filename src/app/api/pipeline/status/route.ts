
import { NextRequest, NextResponse } from "next/server";
import { getExecutionStatus } from "@/lib/step-function";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const arn = searchParams.get("arn");

        if (!arn) {
            return NextResponse.json(
                { error: "Execution ARN is required" },
                { status: 400 }
            );
        }

        const status = await getExecutionStatus(arn);

        return NextResponse.json(status);

    } catch (error: any) {
        console.error("Pipeline Status Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to get status" },
            { status: 500 }
        );
    }
}
