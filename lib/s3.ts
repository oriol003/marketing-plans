import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'oriol-local';

/**
 * Generate a unique filename with a random suffix
 */
function generateUniqueFilename(originalFilename: string): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const extension = originalFilename.includes('.')
        ? originalFilename.substring(originalFilename.lastIndexOf('.'))
        : '';
    const baseName = originalFilename.includes('.')
        ? originalFilename.substring(0, originalFilename.lastIndexOf('.'))
        : originalFilename;

    // Sanitize the base name to be URL-safe
    const sanitizedBaseName = baseName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);

    return `${sanitizedBaseName}-${timestamp}-${randomSuffix}${extension}`;
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(
    file: File | Buffer,
    filename: string,
    options: {
        folder?: string;
        contentType?: string;
        addRandomSuffix?: boolean;
    } = {}
): Promise<{ url: string; key: string }> {
    const { folder = 'uploads', contentType, addRandomSuffix = true } = options;

    // Generate unique filename if requested
    const finalFilename = addRandomSuffix ? generateUniqueFilename(filename) : filename;
    const key = `${folder}/${finalFilename}`;

    // Convert File to Buffer if needed
    let body: Buffer;
    let mimeType: string;

    if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        body = Buffer.from(arrayBuffer);
        mimeType = contentType || file.type || 'application/octet-stream';
    } else {
        body = file;
        mimeType = contentType || 'application/octet-stream';
    }

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: mimeType,
        ACL: 'public-read',
    });

    await s3Client.send(command);

    // Construct the public URL
    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    return { url, key };
}

/**
 * Upload a file from a URL to S3
 */
export async function uploadFromUrlToS3(
    sourceUrl: string,
    filename: string,
    options: {
        folder?: string;
        addRandomSuffix?: boolean;
    } = {}
): Promise<{ url: string; key: string }> {
    const response = await fetch(sourceUrl);

    if (!response.ok) {
        throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return uploadToS3(buffer, filename, { ...options, contentType });
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    await s3Client.send(command);
}

/**
 * Get the public URL for an S3 key
 */
export function getS3Url(key: string): string {
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}
