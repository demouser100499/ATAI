import { NextRequest, NextResponse } from "next/server";
import { fetchCriteriaFromS3, saveCriteriaToS3 } from "@/lib/s3";

interface Criteria {
    criteria_id: string;
    [key: string]: unknown;
}

export async function GET() {
    try {
        const criteria = await fetchCriteriaFromS3();
        return NextResponse.json(criteria);
    } catch (error: unknown) {
        console.error("Criteria GET Error:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const newCriteriaSet = await request.json() as Criteria;

        // Validate basic structure
        if (!newCriteriaSet || !newCriteriaSet.criteria_id) {
            return NextResponse.json({ error: "Invalid criteria set. criteria_id is required." }, { status: 400 });
        }

        const currentCriteria = await fetchCriteriaFromS3() as Criteria[];

        // Check if updating or adding
        const existingIndex = currentCriteria.findIndex((c: Criteria) => c.criteria_id === newCriteriaSet.criteria_id);

        if (existingIndex > -1) {
            currentCriteria[existingIndex] = { ...currentCriteria[existingIndex], ...newCriteriaSet };
        } else {
            currentCriteria.push(newCriteriaSet);
        }

        await saveCriteriaToS3(currentCriteria);

        return NextResponse.json({ message: "Criteria saved successfully", count: currentCriteria.length });
    } catch (error: unknown) {
        console.error("Criteria POST Error:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
