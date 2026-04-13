import { Router, Response } from 'express';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { MEDIA_BUCKET_NAME } from '../services/mediaStoreService';

const router = Router();

function parseRange(rangeHeader: string, totalLength: number): { start: number; end: number } | null {
    const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) return null;
    const rawStart = match[1];
    const rawEnd = match[2];

    let start = rawStart ? Number(rawStart) : 0;
    let end = rawEnd ? Number(rawEnd) : totalLength - 1;

    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    if (start < 0) start = 0;
    if (end >= totalLength) end = totalLength - 1;
    if (start > end) return null;
    return { start, end };
}

router.get('/:fileId', async (req, res: Response): Promise<void> => {
    const { fileId } = req.params;
    if (!ObjectId.isValid(fileId)) {
        res.status(400).json({ success: false, error: 'Invalid media ID' });
        return;
    }

    const db = mongoose.connection.db;
    if (!db) {
        res.status(503).json({ success: false, error: 'Database not ready' });
        return;
    }

    const objectId = new ObjectId(fileId);
    const filesCollection = db.collection(`${MEDIA_BUCKET_NAME}.files`);
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: MEDIA_BUCKET_NAME });

    const fileDoc = await filesCollection.findOne<{ length: number; contentType?: string; uploadDate?: Date }>({ _id: objectId });
    if (!fileDoc) {
        res.status(404).json({ success: false, error: 'Media not found' });
        return;
    }

    const contentType = fileDoc.contentType || 'application/octet-stream';
    const totalLength = fileDoc.length;
    const rangeHeader = req.headers.range;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (fileDoc.uploadDate) {
        res.setHeader('Last-Modified', fileDoc.uploadDate.toUTCString());
    }

    const isHeadRequest = req.method === 'HEAD';

    if (typeof rangeHeader === 'string' && rangeHeader.trim().length > 0) {
        const parsed = parseRange(rangeHeader.trim(), totalLength);
        if (!parsed) {
            res.status(416).setHeader('Content-Range', `bytes */${totalLength}`);
            res.end();
            return;
        }
        const { start, end } = parsed;
        const chunkSize = end - start + 1;
        res.status(206);
        res.setHeader('Content-Length', String(chunkSize));
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalLength}`);
        if (typeof res.flushHeaders === 'function') {
            res.flushHeaders();
        }

        if (isHeadRequest) {
            res.end();
            return;
        }

        const stream = bucket.openDownloadStream(objectId, { start, end: end + 1 });
        stream.on('error', () => {
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: 'Failed to stream media' });
                return;
            }
            res.end();
        });
        stream.pipe(res);
        return;
    }

    res.status(200);
    res.setHeader('Content-Length', String(totalLength));
    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
    }
    if (isHeadRequest) {
        res.end();
        return;
    }
    const stream = bucket.openDownloadStream(objectId);
    stream.on('error', () => {
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Failed to stream media' });
            return;
        }
        res.end();
    });
    stream.pipe(res);
});

export default router;
