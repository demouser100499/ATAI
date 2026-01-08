
import { SFNClient, StartExecutionCommand, DescribeExecutionCommand, StopExecutionCommand } from "@aws-sdk/client-sfn";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { parquetReadObjects } from "hyparquet";

const sfnClient = new SFNClient({
    region: process.env.AWS_REGION || "eu-north-1",
    // credentials: {
    //     accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    //     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    // },
});

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "eu-north-1",
    // credentials: {
    //     accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    //     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    // },
});

const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION || "eu-north-1",
    // credentials: {
    //     accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    //     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    // },
});

let STATE_MACHINE_ARN = process.env.STEP_FUNCTION_ARN;

// Sanitize SFN ARN (remove trailing colons)
if (STATE_MACHINE_ARN && STATE_MACHINE_ARN.endsWith(':')) {
    STATE_MACHINE_ARN = STATE_MACHINE_ARN.slice(0, -1);
}
const S3_RANKED_BUCKET = process.env.S3_RANKED_BUCKET;
let CRITERIA_EVALUATOR_FUNCTION = process.env.CRITERIA_EVALUATOR_FUNCTION || "atai-criteria-evaluator";

// Sanitize Lambda function name/ARN (remove trailing colons which cause ValidationException)
if (CRITERIA_EVALUATOR_FUNCTION.endsWith(':')) {
    CRITERIA_EVALUATOR_FUNCTION = CRITERIA_EVALUATOR_FUNCTION.slice(0, -1);
}

export interface PipelineFilters {
    location?: string;
    category?: string;
    trendPeriod?: string | number;
    variantLimitMax?: string | number;
    size?: string | number;
    amazonFilters?: boolean;
    alibabaFilters?: boolean;
    blacklist?: string;
}

function ensureInt(val: string | number | undefined, fallback: number): number {
    if (val === undefined || val === null || val === '') return fallback;
    return typeof val === 'number' ? Math.floor(val) : parseInt(val) || fallback;
}

export async function startPipelineExecution(keyword: string, filters: PipelineFilters = {}, search_mode: string = 'manual_search') {
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
        const trend_window_months = ensureInt(filters.trendPeriod, 12);
        const variant_limit = ensureInt(filters.variantLimitMax, 50);
        const size = ensureInt(filters.size, 10);
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
            return {
                executionArn: `category_search:${category}:${Date.now()}`,
                status: responsePayload.status === 'NO_KEYWORDS' ? 'FAILED' : 'SUCCEEDED',
                message: responsePayload.status === 'NO_KEYWORDS' ? 'No keywords found for this category' : 'Pipeline started'
            };
        } catch (error) {
            console.error("Error invoking criteria_evaluator:", error);
            throw error;
        }
    }

    const geo = filters.location;
    const category = filters.category;
    const trend_window_months = ensureInt(filters.trendPeriod, 12);
    const variant_limit = ensureInt(filters.variantLimitMax, 50);
    const size = ensureInt(filters.size, 10);
    const enable_amazon = !!filters.amazonFilters;
    const enable_alibaba = !!filters.alibabaFilters;

    const executionName = `manual_${keyword.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    const input = JSON.stringify({
        keyword,
        search_mode,
        search_category: category || "",
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
    return {
        executionArn: response.executionArn,
        status: 'SUCCEEDED',
        message: 'Pipeline started successfully'
    };
}

export async function getExecutionStatus(executionArn: string) {
    if (executionArn.startsWith('category_search:')) {
        // For category search, since it's a direct Lambda call, we don't have a real ARN
        // We assume it's "succeeded" almost immediately or we just return a status
        // In a real scenario, we might track the Lambda execution or check S3 for output
        return {
            status: 'SUCCEEDED',
            startDate: new Date(),
            stopDate: new Date()
        };
    }

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
    if (executionArn.startsWith('category_search:')) {
        return new Date();
    }

    const command = new StopExecutionCommand({
        executionArn,
    });

    const response = await sfnClient.send(command);
    return response.stopDate;
}

import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export async function getPreliminaryResults(keyword?: string, search_mode: string = "manual_search", category?: string) {
    try {
        if (search_mode === 'category_search') {
            const prefix = "consolidated/category_search/";
            const listCommand = new ListObjectsV2Command({
                Bucket: S3_RANKED_BUCKET,
                Prefix: prefix
            });
            const listResponse = await s3Client.send(listCommand);

            if (!listResponse.Contents || listResponse.Contents.length === 0) {
                return [];
            }

            const allResults: Record<string, unknown>[] = [];

            // Read all parquet files in the category search folder
            const readPromises = listResponse.Contents
                .filter(obj => obj.Key && obj.Key.endsWith('.parquet'))
                .map(async (obj) => {
                    try {
                        const command = new GetObjectCommand({ Bucket: S3_RANKED_BUCKET, Key: obj.Key });
                        const response = await s3Client.send(command);
                        const bodyValue = await response.Body?.transformToByteArray();

                        if (!bodyValue) return [];

                        const arrayBuffer = bodyValue.buffer.slice(bodyValue.byteOffset, bodyValue.byteOffset + bodyValue.byteLength) as ArrayBuffer;
                        return await parquetReadObjects({ file: arrayBuffer }) as Record<string, unknown>[];
                    } catch (e) {
                        console.error(`Error reading preliminary file ${obj.Key}:`, e);
                        return [];
                    }
                });

            const fileContents = await Promise.all(readPromises);
            fileContents.forEach(results => allResults.push(...results));

            // Filter by category if provided
            const filtered = allResults.filter((record) =>
                !category || (typeof record.search_category === 'string' && record.search_category.toLowerCase() === category.toLowerCase()) ||
                (typeof record.category === 'string' && record.category.toLowerCase().includes(category.toLowerCase()))
            ).slice(0, 100);

            return filtered;
        }

        // Default manual search flow
        const command = new GetObjectCommand({
            Bucket: S3_RANKED_BUCKET,
            Key: "consolidated/manual_search/consolidated_data.parquet"
        });

        const response = await s3Client.send(command);

        if (!response.Body) {
            return [];
        }

        const bodyValue = await response.Body.transformToByteArray();
        const arrayBuffer = bodyValue.buffer.slice(bodyValue.byteOffset, bodyValue.byteOffset + bodyValue.byteLength) as ArrayBuffer;

        const results = await parquetReadObjects({
            file: arrayBuffer,
        }) as Record<string, unknown>[];

        // Filter by keyword if provided
        const filtered = results.filter((record) =>
            !keyword || (typeof record.keyword === 'string' && record.keyword.toLowerCase().includes(keyword.toLowerCase()))
        ).slice(0, 50); // Limit to 50 results to avoid overwhelming the UI

        return filtered;
    } catch (error: unknown) {
        console.error("Error reading preliminary results:", error);
        // Return empty array if file doesn't exist yet (pipeline still running)
        const s3Error = error as { name?: string; Code?: string };
        if (s3Error.name === 'NoSuchKey' || s3Error.Code === 'NoSuchKey') {
            return [];
        }
        throw error;
    }
}









