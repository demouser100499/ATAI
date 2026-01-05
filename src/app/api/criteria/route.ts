import { NextRequest, NextResponse } from "next/server";
import { fetchCriteriaFromS3, saveCriteriaToS3 } from "@/lib/s3";

export async function GET() {
    try {
        const criteria = await fetchCriteriaFromS3();
        return NextResponse.json(criteria);
    } catch (error: any) {
        console.error("Criteria GET Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const newCriteriaSet = await request.json();

        // Validate basic structure
        if (!newCriteriaSet || !newCriteriaSet.criteria_id) {
            return NextResponse.json({ error: "Invalid criteria set. criteria_id is required." }, { status: 400 });
        }

        const currentCriteria = await fetchCriteriaFromS3();

        // Check if updating or adding
        const existingIndex = currentCriteria.findIndex((c: any) => c.criteria_id === newCriteriaSet.criteria_id);

        if (existingIndex > -1) {
            currentCriteria[existingIndex] = { ...currentCriteria[existingIndex], ...newCriteriaSet };
        } else {
            currentCriteria.push(newCriteriaSet);
        }

        await saveCriteriaToS3(currentCriteria);

        return NextResponse.json({ message: "Criteria saved successfully", count: currentCriteria.length });
    } catch (error: any) {
        console.error("Criteria POST Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
