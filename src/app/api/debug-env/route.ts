import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    AWS_REGION: process.env.AWS_REGION,
    S3_RANKED_BUCKET: process.env.S3_RANKED_BUCKET,
    S3_RANKED_KEY: process.env.S3_RANKED_KEY,
    S3_CONFIG_BUCKET: process.env.S3_CONFIG_BUCKET,
    S3_CRITERIA_KEY: process.env.S3_CRITERIA_KEY,
    STEP_FUNCTION_ARN: process.env.STEP_FUNCTION_ARN,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  });
}