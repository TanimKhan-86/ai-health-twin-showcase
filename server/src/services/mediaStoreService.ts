import { once } from 'events';
import { GridFSBucket, ObjectId } from 'mongodb';
import express from 'express';
import mongoose from 'mongoose';

const MEDIA_REF_PREFIX = 'media://';
const MEDIA_BUCKET_NAME = process.env.MEDIA_BUCKET_NAME || 'avatarMedia';

interface ParsedDataUri {
    buffer: Buffer;
    mimeType: string;
}

function getMediaBucket(): GridFSBucket {
    const db = mongoose.connection.db;
    if (!db) {
        throw new Error('MongoDB connection is not ready');
    }
    return new mongoose.mongo.GridFSBucket(db, { bucketName: MEDIA_BUCKET_NAME });
}

function sanitizeExtension(ext: string): string {
    return ext.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function extensionFromMimeType(mimeType: string): string {
    const normalized = mimeType.trim().toLowerCase();
    if (normalized === 'image/png') return 'png';
    if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg';
    if (normalized === 'image/webp') return 'webp';
    if (normalized === 'image/gif') return 'gif';
    if (normalized === 'video/mp4') return 'mp4';
    if (normalized === 'video/quicktime') return 'mov';
    if (normalized === 'video/x-m4v') return 'm4v';
    return 'bin';
}

function parseDataUri(value: string): ParsedDataUri | null {
    const match = value.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return {
        mimeType: match[1],
        buffer: Buffer.from(match[2], 'base64'),
    };
}

function buildStorageFilename(prefix: string, mimeType: string): string {
    const ext = sanitizeExtension(extensionFromMimeType(mimeType));
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
}

function normalizeProto(protoHeader: string | string[] | undefined, fallback: string): string {
    if (Array.isArray(protoHeader)) {
        const first = protoHeader[0];
        if (first && first.trim().length > 0) return first.trim();
        return fallback;
    }
    if (typeof protoHeader === 'string' && protoHeader.trim().length > 0) {
        return protoHeader.trim();
    }
    return fallback;
}

export function isDataUri(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.startsWith('data:');
}

export function isMediaRef(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.startsWith(MEDIA_REF_PREFIX);
}

export function mediaRefFromFileId(fileId: string): string {
    return `${MEDIA_REF_PREFIX}${fileId}`;
}

export function fileIdFromMediaRef(mediaRef: string): string | null {
    if (!isMediaRef(mediaRef)) return null;
    const fileId = mediaRef.slice(MEDIA_REF_PREFIX.length).trim();
    if (!ObjectId.isValid(fileId)) return null;
    return fileId;
}

export function buildMediaUrl(req: express.Request, fileId: string): string {
    const protocol = normalizeProto(req.headers['x-forwarded-proto'], req.protocol || 'http');
    const host = req.get('host');
    if (host && host.trim().length > 0) {
        return `${protocol}://${host}/api/media/${fileId}`;
    }
    const port = process.env.PORT || '4000';
    return `http://localhost:${port}/api/media/${fileId}`;
}

export function resolveMediaUrlForClient(
    req: express.Request,
    value: string | null | undefined
): string | null {
    if (!value) return null;
    const fileId = fileIdFromMediaRef(value);
    if (!fileId) return value;
    return buildMediaUrl(req, fileId);
}

export async function storeBufferAsMediaRef(
    buffer: Buffer,
    mimeType: string,
    metadata: Record<string, unknown> = {},
    filenamePrefix = 'media'
): Promise<string> {
    const bucket = getMediaBucket();
    const filename = buildStorageFilename(filenamePrefix, mimeType);
    const uploadStream = bucket.openUploadStream(filename, {
        contentType: mimeType,
        metadata,
    });
    uploadStream.end(buffer);
    await once(uploadStream, 'finish');
    return mediaRefFromFileId(String(uploadStream.id));
}

export async function storeDataUriAsMediaRef(
    dataUri: string,
    metadata: Record<string, unknown> = {},
    filenamePrefix = 'media'
): Promise<string> {
    const parsed = parseDataUri(dataUri);
    if (!parsed) throw new Error('Invalid data URI');
    return storeBufferAsMediaRef(parsed.buffer, parsed.mimeType, metadata, filenamePrefix);
}

export async function ensureMediaRefFromValue(
    value: string | null | undefined,
    metadata: Record<string, unknown> = {},
    filenamePrefix = 'media'
): Promise<string | null> {
    if (!value) return null;
    if (isMediaRef(value)) return value;
    if (!isDataUri(value)) return value;
    return storeDataUriAsMediaRef(value, metadata, filenamePrefix);
}

export async function readMediaByFileId(fileId: string): Promise<{ buffer: Buffer; mimeType: string; length: number }> {
    if (!ObjectId.isValid(fileId)) {
        throw new Error('Invalid media file ID');
    }
    const objectId = new ObjectId(fileId);
    const bucket = getMediaBucket();
    const filesCollection = mongoose.connection.db?.collection(`${MEDIA_BUCKET_NAME}.files`);
    if (!filesCollection) {
        throw new Error('Media files collection is not available');
    }
    const fileDoc = await filesCollection.findOne<{ length: number; contentType?: string }>({ _id: objectId });
    if (!fileDoc) {
        throw new Error('Media file not found');
    }
    const chunks: Buffer[] = [];
    const downloadStream = bucket.openDownloadStream(objectId);
    downloadStream.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    await once(downloadStream, 'end');
    return {
        buffer: Buffer.concat(chunks),
        mimeType: fileDoc.contentType || 'application/octet-stream',
        length: fileDoc.length,
    };
}

export async function readMediaByRef(mediaRef: string): Promise<{ buffer: Buffer; mimeType: string; length: number }> {
    const fileId = fileIdFromMediaRef(mediaRef);
    if (!fileId) {
        throw new Error('Invalid media reference');
    }
    return readMediaByFileId(fileId);
}

export { MEDIA_BUCKET_NAME };
