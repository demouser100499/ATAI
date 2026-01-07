

import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { parquetMetadata, parquetRead, parquetReadObjects } from "hyparquet";

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "eu-north-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

export async function fetchProductsFromS3(search_mode: string = 'manual_search') {
    const bucket = process.env.S3_RANKED_BUCKET;
    if (!bucket) {
        console.warn("S3_RANKED_BUCKET is not defined. Falling back to atai-clean-layer.");
    }
    const targetBucket = bucket || "atai-clean-layer";

    try {
        if (search_mode === 'category_search') {
            const prefix = "consolidated/category_search/";
            const listCommand = new ListObjectsV2Command({
                Bucket: targetBucket,
                Prefix: prefix
            });
            const listResponse = await s3Client.send(listCommand);

            if (!listResponse.Contents || listResponse.Contents.length === 0) {
                return [];
            }

            const allProducts: any[] = [];

            // Limit to recent/relevant files if needed, but for now read all in the folder
            // Use Promise.all for parallel reading
            const readPromises = listResponse.Contents
                .filter(obj => obj.Key && obj.Key.endsWith('.parquet'))
                .map(async (obj) => {
                    try {
                        const command = new GetObjectCommand({ Bucket: targetBucket, Key: obj.Key });
                        const response = await s3Client.send(command);
                        const body = await response.Body?.transformToByteArray();

                        if (!body) return [];

                        const arrayBuffer = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
                        return await parquetReadObjects({ file: arrayBuffer as any });
                    } catch (e) {
                        console.error(`Error reading file ${obj.Key}:`, e);
                        return [];
                    }
                });

            const results = await Promise.all(readPromises);
            results.forEach(products => allProducts.push(...products));

            return allProducts;
        } else {
            // Default to manual search single file
            const key = process.env.S3_RANKED_KEY || "ranked/manual_search/ranked_results.parquet";
            console.log(`Fetching products from S3 bucket: ${targetBucket}, key: ${key}`);

            try {
                const command = new GetObjectCommand({ Bucket: targetBucket, Key: key });
                const response = await s3Client.send(command);
                const body = await response.Body?.transformToByteArray();
                console.log("Fetched object from S3:", body ? body.length : "no body");
                if (!body) return [];

                const arrayBuffer = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;

                return await parquetReadObjects({
                    file: arrayBuffer as any,
                });
            } catch (e: any) {
                if (e.name === 'NoSuchKey') return [];
                throw e;
            }
        }
    } catch (error) {
        console.error("Error fetching products from S3:", error);
        return [];
    }
}

export async function fetchCriteriaFromS3() {
    const bucket = process.env.S3_CONFIG_BUCKET || "atai-config";
    const key = process.env.S3_CRITERIA_KEY || "discovery_criteria.json";

    try {
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const response = await s3Client.send(command);
        const bodyString = await response.Body?.transformToString();
        return bodyString ? jsonSafeParse(bodyString, []) : [];
    } catch (error: unknown) {
        if ((error as { name?: string }).name === "NoSuchKey") return [];
        throw error;
    }
}

export async function saveCriteriaToS3(criteria: unknown[]) {
    const bucket = process.env.S3_CONFIG_BUCKET || "atai-config";
    const key = process.env.S3_CRITERIA_KEY || "discovery_criteria.json";

    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(criteria, null, 2),
        ContentType: "application/json",
    });

    await s3Client.send(command);
}

function jsonSafeParse<T>(str: string, fallback: T): T {
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}
