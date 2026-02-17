
import { SFNClient, StartExecutionCommand, DescribeExecutionCommand, StopExecutionCommand, GetExecutionHistoryCommand } from "@aws-sdk/client-sfn";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { parquetReadObjects } from "hyparquet";
import { getRelatedQueriesForCategory } from "./google-trends-keywords";
import { discoverCategoryKeywords } from "./category-keywords";

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
    /** FCL percentage (0–1) for amazon_fcl_enrichment */
    fcl_percentage?: number;
    /** Keyword planner / search volume min */
    search_volume_min?: string | number;
    /** Google Trend score min (0–100) */
    google_trend_score?: number;
    /** Amazon: price min/max */
    amz_price_min?: number;
    amz_price_max?: number;
    /** Amazon: reviews min/max */
    reviews_min?: number;
    reviews_max?: number;
    /** Amazon: rating min (1–5) */
    rating_min?: number;
    /** Amazon: FCL min/max */
    fcl_min?: number;
    fcl_max?: number;
    /** Alibaba: margin/cost below % (0–1) */
    margin_min?: number;
    /** Alibaba: MOQ max */
    moq_max?: number;
    /** Alibaba: supplier rating min */
    supplier_rating_min?: number;
    /** Alibaba: verified supplier */
    verified_supplier?: boolean;
}

function ensureInt(val: string | number | undefined, fallback: number): number {
    if (val === undefined || val === null || val === '') return fallback;
    return typeof val === 'number' ? Math.floor(val) : parseInt(val) || fallback;
}

/** Build pipeline input and start a single Step Function execution. Used for manual/auto and for each keyword in category search. */
async function buildInputAndStartExecution(
    keyword: string,
    filters: PipelineFilters,
    search_mode: string
): Promise<{ executionArn: string; executionName: string }> {
    const geo = filters.location;
    const category = filters.category;
    const trend_window_months = ensureInt(filters.trendPeriod, 12);
    const variant_limit = ensureInt(filters.variantLimitMax, 50);
    const size = ensureInt(filters.size, 10);
    const enable_amazon = !!filters.amazonFilters;
    const enable_alibaba = !!filters.alibabaFilters;

    const fcl_percentage = filters.fcl_percentage != null ? Number(filters.fcl_percentage) : 0;
    const blacklist = (filters.blacklist ?? "").toString();
    const search_volume_min = ensureInt(filters.search_volume_min, 0);
    const google_trend_score = filters.google_trend_score != null ? Number(filters.google_trend_score) : 0;

    const amz_price_min = filters.amz_price_min != null ? Number(filters.amz_price_min) : 0;
    const amz_price_max = filters.amz_price_max != null ? Number(filters.amz_price_max) : 999999;
    const reviews_min = filters.reviews_min != null ? Number(filters.reviews_min) : 0;
    const reviews_max = filters.reviews_max != null ? Number(filters.reviews_max) : 999999;
    const rating_min = filters.rating_min != null ? Number(filters.rating_min) : 0;
    const fcl_min = filters.fcl_min != null ? Number(filters.fcl_min) : 0;
    const fcl_max = filters.fcl_max != null ? Number(filters.fcl_max) : 999999;

    const margin_min = filters.margin_min != null ? Number(filters.margin_min) : 0;
    const moq_max = ensureInt(filters.moq_max, 999999);
    const supplier_rating_min = filters.supplier_rating_min != null ? Number(filters.supplier_rating_min) : 0;
    const verified_supplier = !!filters.verified_supplier;

    const executionName = `manual_${keyword.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    const inputObj: Record<string, unknown> = {
        keyword,
        search_mode,
        search_category: category || "",
        timestamp: new Date().toISOString(),
        category: category || "",
        size,
        trend_window_months,
        geo,
        variant_limit,
        enable_amazon,
        enable_alibaba,
        blacklist,
        fcl_percentage,
        search_volume_min,
        google_trend_score,
        amz_price_min,
        amz_price_max,
        reviews_min,
        reviews_max,
        rating_min,
        fcl_min,
        fcl_max,
        margin_min,
        moq_max,
        supplier_rating_min,
        verified_supplier,
    };
    const input = JSON.stringify(inputObj);

    const command = new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN!,
        name: executionName,
        input,
    });

    const response = await sfnClient.send(command);
    return { executionArn: response.executionArn!, executionName };
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
        // Generate keywords: prefer SerpAPI discovery (seeds + autocomplete + shopping), else Google Trends relatedQueries, else category name
        const category = filters.category;
        const geo = filters.location ?? "";
        const trend_window_months = ensureInt(filters.trendPeriod, 12);
        const variant_limit = ensureInt(filters.variantLimitMax, 50);

        try {
            let rawKeywords: string[] = [];

            rawKeywords = await discoverCategoryKeywords(category ?? "", geo, {
                limit: variant_limit,
                maxSeeds: 5,
            });

            if (rawKeywords.length === 0) {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setMonth(startDate.getMonth() - trend_window_months);
                rawKeywords = await getRelatedQueriesForCategory(category ?? "", geo, {
                    startTime: startDate,
                    endTime: endDate,
                    limit: variant_limit,
                });
                if (rawKeywords.length > 0) {
                    console.log("Category search: Using Google Trends fallback for", category);
                }
            } else {
                console.log("Category search: Using SerpAPI discovery for", category);
            }

            const keywords = rawKeywords.length > 0
                ? rawKeywords
                : [category ?? "unknown category"];
            if (rawKeywords.length === 0) {
                console.log("Category search: No keywords from discovery or Trends for", category, "- using category name as keyword");
            }

            console.log("Category search: keywords for", category, ":", keywords.slice(0, 10), keywords.length > 10 ? `... (${keywords.length} total)` : "");

            const execution_details: { keyword: string; run_id: string; execution_arn: string }[] = [];
            for (const kw of keywords.slice(0, variant_limit)) {
                const r = await buildInputAndStartExecution(kw, filters, 'manual_search');
                execution_details.push({ keyword: kw, run_id: r.executionName, execution_arn: r.executionArn });
            }

            return {
                executionArn: `category_search:${category}:${Date.now()}`,
                execution_details,
                status: 'SUCCEEDED' as const,
                message: 'Pipeline started'
            };
        } catch (error) {
            console.error("Category search (Google Trends keywords):", error);
            throw error;
        }
    }

    const r = await buildInputAndStartExecution(keyword, filters, search_mode);
    return {
        executionArn: r.executionArn,
        status: 'SUCCEEDED',
        message: 'Pipeline started successfully'
    };
}

export async function getExecutionStatus(executionArn: string) {
    if (executionArn.startsWith('category_search:')) {
        // For category search, we return RUNNING. The frontend will manage the completion
        // based on the individual child executions.
        return {
            status: 'RUNNING',
            startDate: new Date(),
            stopDate: undefined
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

interface KeywordPlannerCleanOutput {
    message: string;
    rows: number;
    input_file: string;
    output_file: string;
}

export interface KeywordPlannerStageResult {
    available: boolean;
    kwp_clean?: KeywordPlannerCleanOutput;
    results?: Record<string, unknown>[];
}

function parseS3Url(url: string): { bucket: string; key: string } | null {
    if (!url.startsWith("s3://")) return null;
    const withoutScheme = url.slice("s3://".length);
    const firstSlash = withoutScheme.indexOf("/");
    if (firstSlash === -1) return null;
    const bucket = withoutScheme.slice(0, firstSlash);
    const key = withoutScheme.slice(firstSlash + 1);
    return { bucket, key };
}

export async function getKeywordPlannerStageResults(executionArn: string): Promise<KeywordPlannerStageResult> {
    // Category search currently does not use this manual search keyword planner stage
    if (executionArn.startsWith("category_search:")) {
        return { available: false };
    }

    try {
        const historyCommand = new GetExecutionHistoryCommand({
            executionArn,
            reverseOrder: true,
            maxResults: 1000
        });

        const history = await sfnClient.send(historyCommand);
        const events = history.events || [];

        // Find the most recent TaskStateExited event for the KeywordPlannerClean state
        const kwpEvent = events.find(event =>
            event.type === "TaskStateExited" &&
            event.stateExitedEventDetails &&
            event.stateExitedEventDetails.name === "KeywordPlannerClean"
        );

        if (!kwpEvent || !kwpEvent.stateExitedEventDetails || !kwpEvent.stateExitedEventDetails.output) {
            return { available: false };
        }

        let outputJson: unknown;
        try {
            outputJson = JSON.parse(kwpEvent.stateExitedEventDetails.output);
        } catch (e) {
            console.error("Failed to parse KeywordPlannerClean output JSON:", e);
            return { available: false };
        }

        const state = outputJson as Record<string, unknown>;
        const kwpClean = state.kwp_clean as KeywordPlannerCleanOutput | undefined;

        if (!kwpClean || !kwpClean.output_file) {
            return { available: false };
        }

        const s3Location = parseS3Url(kwpClean.output_file);
        if (!s3Location) {
            console.error("Invalid S3 URL in kwp_clean.output_file:", kwpClean.output_file);
            return { available: false, kwp_clean: kwpClean };
        }

        const objectCommand = new GetObjectCommand({
            Bucket: s3Location.bucket,
            Key: s3Location.key
        });

        const objectResponse = await s3Client.send(objectCommand);
        if (!objectResponse.Body) {
            return { available: true, kwp_clean: kwpClean, results: [] };
        }

        const bodyValue = await objectResponse.Body.transformToByteArray();
        const arrayBuffer = bodyValue.buffer.slice(bodyValue.byteOffset, bodyValue.byteOffset + bodyValue.byteLength) as ArrayBuffer;

        const results = await parquetReadObjects({
            file: arrayBuffer
        }) as Record<string, unknown>[];

        // Limit rows for UI safety
        const limitedResults = results.slice(0, 100);

        return {
            available: true,
            kwp_clean: kwpClean,
            results: limitedResults
        };
    } catch (error) {
        console.error("Error fetching Keyword Planner stage results:", error);
        return { available: false };
    }
}

interface GoogleTrendsCleanOutput {
    message: string;
    rows: number;
    input_file: string;
    output_file: string;
}

export interface GoogleTrendsStageResult {
    available: boolean;
    trends_clean?: GoogleTrendsCleanOutput;
    results?: Record<string, unknown>[];
}

export async function getGoogleTrendsStageResults(executionArn: string): Promise<GoogleTrendsStageResult> {
    // Category search may use a different orchestration; for now treat manual executions only
    if (executionArn.startsWith("category_search:")) {
        return { available: false };
    }

    try {
        const historyCommand = new GetExecutionHistoryCommand({
            executionArn,
            reverseOrder: true,
            maxResults: 1000
        });

        const history = await sfnClient.send(historyCommand);
        const events = history.events || [];

        // Find the most recent TaskStateExited event for the GoogleTrendsClean state
        const trendsEvent = events.find(event =>
            event.type === "TaskStateExited" &&
            event.stateExitedEventDetails &&
            event.stateExitedEventDetails.name === "GoogleTrendsClean"
        );

        if (!trendsEvent || !trendsEvent.stateExitedEventDetails || !trendsEvent.stateExitedEventDetails.output) {
            return { available: false };
        }

        let outputJson: unknown;
        try {
            outputJson = JSON.parse(trendsEvent.stateExitedEventDetails.output);
        } catch (e) {
            console.error("Failed to parse GoogleTrendsClean output JSON:", e);
            return { available: false };
        }

        const state = outputJson as Record<string, unknown>;
        const trendsClean = state.trends_clean as GoogleTrendsCleanOutput | undefined;

        if (!trendsClean || !trendsClean.output_file) {
            return { available: false };
        }

        const s3Location = parseS3Url(trendsClean.output_file);
        if (!s3Location) {
            console.error("Invalid S3 URL in trends_clean.output_file:", trendsClean.output_file);
            return { available: false, trends_clean: trendsClean };
        }

        const objectCommand = new GetObjectCommand({
            Bucket: s3Location.bucket,
            Key: s3Location.key
        });

        const objectResponse = await s3Client.send(objectCommand);
        if (!objectResponse.Body) {
            return { available: true, trends_clean: trendsClean, results: [] };
        }

        const bodyValue = await objectResponse.Body.transformToByteArray();
        const arrayBuffer = bodyValue.buffer.slice(bodyValue.byteOffset, bodyValue.byteOffset + bodyValue.byteLength) as ArrayBuffer;

        const results = await parquetReadObjects({
            file: arrayBuffer
        }) as Record<string, unknown>[];

        const limitedResults = results.slice(0, 100);

        return {
            available: true,
            trends_clean: trendsClean,
            results: limitedResults
        };
    } catch (error) {
        console.error("Error fetching Google Trends stage results:", error);
        return { available: false };
    }
}

interface AmazonCleanOutput {
    statusCode?: number;
    message: string;
    rows?: number;
    rows_processed?: number;
    input_file: string;
    output_file: string;
}

export interface AmazonStageResult {
    available: boolean;
    amazon_clean?: AmazonCleanOutput;
    results?: Record<string, unknown>[];
}

export async function getAmazonStageResults(executionArn: string): Promise<AmazonStageResult> {
    if (executionArn.startsWith("category_search:")) {
        return { available: false };
    }

    try {
        const describe = await sfnClient.send(new DescribeExecutionCommand({ executionArn }));
        if (!describe.output) {
            return { available: false };
        }

        // The output may itself be a JSON string; parse up to twice
        let parsed: unknown;
        try {
            parsed = JSON.parse(describe.output);
        } catch {
            console.error("Amazon stage: execution output is not valid JSON");
            return { available: false };
        }

        if (typeof parsed === "string") {
            try {
                parsed = JSON.parse(parsed);
            } catch {
                console.error("Amazon stage: nested execution output is not valid JSON");
                return { available: false };
            }
        }

        const state = parsed as Record<string, unknown>;
        const amazonClean = state.amazon_clean as AmazonCleanOutput | undefined;

        if (!amazonClean || !amazonClean.output_file) {
            return { available: false };
        }

        const s3Location = parseS3Url(amazonClean.output_file);
        if (!s3Location) {
            console.error("Invalid S3 URL in amazon_clean.output_file:", amazonClean.output_file);
            return { available: false, amazon_clean: amazonClean };
        }

        const objectCommand = new GetObjectCommand({
            Bucket: s3Location.bucket,
            Key: s3Location.key
        });

        const objectResponse = await s3Client.send(objectCommand);
        if (!objectResponse.Body) {
            return { available: true, amazon_clean: amazonClean, results: [] };
        }

        const bodyValue = await objectResponse.Body.transformToByteArray();
        const arrayBuffer = bodyValue.buffer.slice(bodyValue.byteOffset, bodyValue.byteOffset + bodyValue.byteLength) as ArrayBuffer;

        const results = await parquetReadObjects({
            file: arrayBuffer
        }) as Record<string, unknown>[];

        const limitedResults = results.slice(0, 100);

        return {
            available: true,
            amazon_clean: amazonClean,
            results: limitedResults
        };
    } catch (error) {
        console.error("Error fetching Amazon stage results:", error);
        return { available: false };
    }
}

interface AlibabaCleanOutput {
    statusCode?: number;
    message: string;
    rows?: number;
    rows_processed?: number;
    input_file: string;
    output_file: string;
}

export interface AlibabaStageResult {
    available: boolean;
    alibaba_clean?: AlibabaCleanOutput;
    results?: Record<string, unknown>[];
}

export async function getAlibabaStageResults(executionArn: string): Promise<AlibabaStageResult> {
    if (executionArn.startsWith("category_search:")) {
        return { available: false };
    }

    try {
        const describe = await sfnClient.send(new DescribeExecutionCommand({ executionArn }));
        if (!describe.output) {
            return { available: false };
        }

        // The output may itself be a JSON string; parse up to twice
        let parsed: unknown;
        try {
            parsed = JSON.parse(describe.output);
        } catch {
            console.error("Alibaba stage: execution output is not valid JSON");
            return { available: false };
        }

        if (typeof parsed === "string") {
            try {
                parsed = JSON.parse(parsed);
            } catch {
                console.error("Alibaba stage: nested execution output is not valid JSON");
                return { available: false };
            }
        }

        const state = parsed as Record<string, unknown>;
        const alibabaClean = state.alibaba_clean as AlibabaCleanOutput | undefined;

        if (!alibabaClean || !alibabaClean.output_file) {
            return { available: false };
        }

        const s3Location = parseS3Url(alibabaClean.output_file);
        if (!s3Location) {
            console.error("Invalid S3 URL in alibaba_clean.output_file:", alibabaClean.output_file);
            return { available: false, alibaba_clean: alibabaClean };
        }

        const objectCommand = new GetObjectCommand({
            Bucket: s3Location.bucket,
            Key: s3Location.key
        });

        const objectResponse = await s3Client.send(objectCommand);
        if (!objectResponse.Body) {
            return { available: true, alibaba_clean: alibabaClean, results: [] };
        }

        const bodyValue = await objectResponse.Body.transformToByteArray();
        const arrayBuffer = bodyValue.buffer.slice(bodyValue.byteOffset, bodyValue.byteOffset + bodyValue.byteLength) as ArrayBuffer;

        const results = await parquetReadObjects({
            file: arrayBuffer
        }) as Record<string, unknown>[];

        const limitedResults = results.slice(0, 100);

        return {
            available: true,
            alibaba_clean: alibabaClean,
            results: limitedResults
        };
    } catch (error) {
        console.error("Error fetching Alibaba stage results:", error);
        return { available: false };
    }
}

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









