import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import MoodEntry from '../models/MoodEntry';
import { getUtcDayRange, shiftUtcDays, toUtcDayStart } from '../lib/dateUtils';
import { getErrorMessage, getMongooseValidationMessage, sendError, sendSuccess } from '../lib/apiResponse';
import { parseBody, parseParams, parseQuery, QUERY_LIMITS } from '../lib/validation';

const router = Router();
router.use(authenticate);

const moodSchema = z.enum(['happy', 'sad', 'stressed', 'tired', 'energetic', 'neutral', 'calm', 'anxious', 'excited']);
const todayQuerySchema = z.object({
    date: z.string().trim().optional(),
});

const daysQuerySchema = z.object({
    days: z.coerce
        .number()
        .int()
        .min(QUERY_LIMITS.days.min)
        .max(QUERY_LIMITS.days.max)
        .default(QUERY_LIMITS.days.default),
});

const limitQuerySchema = z.object({
    limit: z.coerce
        .number()
        .int()
        .min(QUERY_LIMITS.historyLimit.min)
        .max(QUERY_LIMITS.historyLimit.max)
        .default(QUERY_LIMITS.historyLimit.default),
});

const idParamSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid entry id'),
});

const moodCreateSchema = z.object({
    date: z.union([z.string(), z.date()]).optional(),
    mood: moodSchema,
    energyLevel: z.coerce.number().int().min(1).max(10),
    stressLevel: z.coerce.number().int().min(1).max(10),
    notes: z.string().trim().max(2000).optional(),
});

const moodUpdateSchema = z.object({
    mood: moodSchema.optional(),
    energyLevel: z.coerce.number().int().min(1).max(10).optional(),
    stressLevel: z.coerce.number().int().min(1).max(10).optional(),
    notes: z.string().trim().max(2000).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

function resolveWriteStatusCode(error: unknown): number {
    const candidate = error as { name?: string; code?: number; message?: string };
    if (candidate?.name === 'ValidationError' || candidate?.code === 11000 || candidate?.message === 'Invalid date') {
        return 400;
    }
    return 500;
}

// GET /api/mood
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
    const query = parseQuery(res, daysQuerySchema, req.query);
    if (!query) return;

    try {
        const todayUtc = toUtcDayStart();
        const since = shiftUtcDays(todayUtc, -(query.days - 1));

        const entries = await MoodEntry.find({
            userId: req.userId,
            date: { $gte: since },
        }).sort({ date: -1 });

        sendSuccess(res, entries);
    } catch (error: unknown) {
        console.error(error);
        sendError(res, 500, getErrorMessage(error));
    }
});

// GET /api/mood/today
router.get('/today', async (req: AuthRequest, res: Response): Promise<void> => {
    const query = parseQuery(res, todayQuerySchema, req.query);
    if (!query) return;

    try {
        const { start, end } = getUtcDayRange(query.date);
        const entry = await MoodEntry.findOne({
            userId: req.userId,
            date: { $gte: start, $lt: end },
        }).sort({ updatedAt: -1, createdAt: -1 });

        sendSuccess(res, entry ?? null);
    } catch (error: unknown) {
        console.error(error);
        sendError(res, 500, getErrorMessage(error));
    }
});

// GET /api/mood/history?limit=7
router.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
    const query = parseQuery(res, limitQuerySchema, req.query);
    if (!query) return;

    try {
        const todayUtc = toUtcDayStart();
        const since = shiftUtcDays(todayUtc, -(query.limit - 1));

        const entries = await MoodEntry.find({
            userId: req.userId,
            date: { $gte: since },
        }).sort({ date: -1 });

        sendSuccess(res, entries);
    } catch (error: unknown) {
        console.error(error);
        sendError(res, 500, getErrorMessage(error));
    }
});

// POST /api/mood
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
    const input = parseBody(res, moodCreateSchema, req.body);
    if (!input) return;

    try {
        const normalizedDate = toUtcDayStart(input.date);
        const entry = await MoodEntry.findOneAndUpdate(
            { userId: req.userId, date: normalizedDate },
            {
                $set: {
                    mood: input.mood,
                    energyLevel: input.energyLevel,
                    stressLevel: input.stressLevel,
                    source: 'mood_api',
                    ...(input.notes !== undefined ? { notes: input.notes } : {}),
                },
                $setOnInsert: {
                    userId: req.userId,
                    date: normalizedDate,
                },
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true,
            }
        );

        sendSuccess(res, entry);
    } catch (error: unknown) {
        console.error(error);
        const statusCode = resolveWriteStatusCode(error);
        const message = getMongooseValidationMessage(error, 'Daily mood log already exists for this date');
        sendError(res, statusCode, message);
    }
});

// PUT /api/mood/:id
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    const params = parseParams(res, idParamSchema, req.params);
    if (!params) return;
    const body = parseBody(res, moodUpdateSchema, req.body);
    if (!body) return;

    try {
        const entry = await MoodEntry.findOneAndUpdate(
            { _id: params.id, userId: req.userId },
            { ...body, source: 'mood_api' },
            { new: true, runValidators: true }
        );
        if (!entry) {
            sendError(res, 404, 'Entry not found');
            return;
        }
        sendSuccess(res, entry);
    } catch (error: unknown) {
        console.error(error);
        sendError(res, 500, getErrorMessage(error));
    }
});

// DELETE /api/mood/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    const params = parseParams(res, idParamSchema, req.params);
    if (!params) return;

    try {
        const entry = await MoodEntry.findOneAndDelete({ _id: params.id, userId: req.userId });
        if (!entry) {
            sendError(res, 404, 'Entry not found');
            return;
        }
        sendSuccess(res, { message: 'Deleted' });
    } catch (error: unknown) {
        console.error(error);
        sendError(res, 500, getErrorMessage(error));
    }
});

export default router;
