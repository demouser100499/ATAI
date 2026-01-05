
import { SFNClient, StartExecutionCommand, DescribeExecutionCommand, StopExecutionCommand } from "@aws-sdk/client-sfn";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { parquetReadObjects } from "hyparquet";

const sfnClient = new SFNClient({
    region: process.env.AWS_REGION || "eu-north-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "eu-north-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION || "eu-north-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

const STATE_MACHINE_ARN = process.env.STEP_FUNCTION_ARN;
const S3_BUCKET = process.env.S3_BUCKET_NAME || "atai-clean-layer";
const CRITERIA_EVALUATOR_FUNCTION = "criteria_evaluator";

export async function startPipelineExecution(keyword: string, filters: any = {}, search_mode: string = 'manual_search') {
    if (!STATE_MACHINE_ARN) {
        console.error("Environment variables:", {
            STEP_FUNCTION_ARN: process.env.STEP_FUNCTION_ARN,
            AWS_REGION: process.env.AWS_REGION,
            NODE_ENV: process.env.NODE_ENV
        });
        throw new Error("STEP_FUNCTION_ARN environment variable is not defined. Please check your .env.local file and restart the development server.");
    }

    console.log("Triggering pipeline for keyword:", keyword, "with filters:", filters, "mode:", search_mode);

    if (search_mode === 'category_search') {
        // Prepare payload for Lambda
        const category = filters.category;
        const geo = filters.location;
        const trend_window_months = parseInt(filters.trendPeriod) || 12;
        const variant_limit = parseInt(filters.variantLimit) || 50;
        const size = parseInt(filters.resultsCap) || 10;
        const enable_amazon = !!filters.amazonFilters;
        const enable_alibaba = !!filters.alibabaFilters;
        const blacklist = filters.blacklist ? filters.blacklist.split(",") : [];

        const payload = {
            search_category: category,
            search_mode: "category_search",
            geo: geo,
            filters: {
                variant_limit,
                daily_result_cap: size, // mapping size to daily_result_cap
                size,
                trend_window_months,
                enable_amazon,
                enable_alibaba,
                blacklist
            }
        };

        try {
            const command = new InvokeCommand({
                FunctionName: CRITERIA_EVALUATOR_FUNCTION,
                Payload: new TextEncoder().encode(JSON.stringify(payload)),
            });

            const response = await lambdaClient.send(command);
            const responsePayload = JSON.parse(new TextDecoder().decode(response.Payload));

            console.log("Criteria Evaluator Response:", responsePayload);

            // Return a virtual execution ARN to track this category search
            // We use a prefix to identify it later in getExecutionStatus
            return `category_search:${category}:${Date.now()}`;
        } catch (error) {
            console.error("Error invoking criteria_evaluator:", error);
            throw error;
        }
    }

    const geo = filters.location;
    const category = filters.category;
    const trend_window_months = parseInt(filters.trendPeriod) || 12;
    const variant_limit = parseInt(filters.variantLimit) || 50;
    const size = parseInt(filters.resultsCap) || 10;
    const enable_amazon = !!filters.amazonFilters;
    const enable_alibaba = !!filters.alibabaFilters;

    const executionName = `manual_${keyword.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    const input = JSON.stringify({
        keyword,
        mode: "manual",
        search_mode,
        timestamp: new Date().toISOString(),
        category,
        size,
        trend_window_months,
        geo,
        variant_limit,
        enable_amazon,
        enable_alibaba
    });

    const command = new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN,
        name: executionName,
        input,
    });

    const response = await sfnClient.send(command);
    return response.executionArn;
}

export async function getExecutionStatus(executionArn: string) {
    const command = new DescribeExecutionCommand({
        executionArn,
    });

    const response = await sfnClient.send(command);
    return {
        status: response.status, // RUNNING, SUCCEEDED, FAILED, TIMED_OUT, ABORTED
        startDate: response.startDate,
        stopDate: response.stopDate,
        output: response.output,
        error: response.error,
        cause: response.cause
    };
}

export async function stopPipelineExecution(executionArn: string) {
    const command = new StopExecutionCommand({
        executionArn,
    });

    const response = await sfnClient.send(command);
    return response.stopDate;
}

export async function getPreliminaryResults(keyword?: string) {
    try {
        // Read consolidated data from S3
        const command = new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: "consolidated/consolidated_data.parquet"
        });

        const response = await s3Client.send(command);

        if (!response.Body) {
            return [];
        }

        const bodyValue = await response.Body.transformToByteArray();
        const arrayBuffer = bodyValue.buffer.slice(bodyValue.byteOffset, bodyValue.byteOffset + bodyValue.byteLength) as ArrayBuffer;

        const results = await parquetReadObjects({
            file: arrayBuffer,
        });

        // Filter by keyword if provided
        const filtered = results.filter((record: any) =>
            !keyword || record.keyword?.toLowerCase().includes(keyword.toLowerCase())
        ).slice(0, 50); // Limit to 50 results to avoid overwhelming the UI

        return filtered;
    } catch (error: any) {
        console.error("Error reading preliminary results:", error);
        // Return empty array if file doesn't exist yet (pipeline still running)
        if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
            return [];
        }
        throw error;
    }
}
