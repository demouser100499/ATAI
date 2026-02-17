import { NextRequest, NextResponse } from "next/server";
import { getAlibabaStageResults } from "@/lib/step-function";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const arn = searchParams.get("arn");

        if (!arn) {
            console.error("Alibaba stage API called without arn");
            return NextResponse.json(
                { error: "Execution ARN is required" },
                { status: 400 }
            );
        }

        console.log("Alibaba stage API called with arn:", arn);
        const stageResult = await getAlibabaStageResults(arn);
        console.log("Alibaba stageResult:", {
            available: stageResult.available,
            hasMeta: !!stageResult.alibaba_clean,
            rows: stageResult.results?.length ?? 0
        });

        if (!stageResult.available) {
            return NextResponse.json({
                success: false,
                message: "Alibaba marketplace stage not completed yet",
                available: false
            });
        }

        const serialized = JSON.parse(JSON.stringify(stageResult.results || [], (key, value) =>
            typeof value === "bigint" ? Number(value) : value
        ));

        return NextResponse.json({
            success: true,
            available: true,
            meta: stageResult.alibaba_clean,
            count: serialized.length,
            results: serialized
        });
    } catch (error: unknown) {
        console.error("Alibaba Marketplace Stage API Error:", error);
        return NextResponse.json(
            { error: (error as Error).message || "Failed to fetch Alibaba marketplace stage results" },
            { status: 500 }
        );
    }
}

