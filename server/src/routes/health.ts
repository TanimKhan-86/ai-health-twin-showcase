import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import HealthEntry from '../models/HealthEntry';
import MoodEntry from '../models/MoodEntry';
import { getUtcDayRange, shiftUtcDays, toUtcDayStart } from '../lib/dateUtils';
import { getErrorMessage, getMongooseValidationMessage, sendError, sendSuccess } from '../lib/apiResponse';
import { parseBody, parseParams, parseQuery, QUERY_LIMITS } from '../lib/validation';

const router = Router();
router.use(authenticate);
const DEMO_HEALTH_NOTE_PATTERN = /^Demo entry day/i;
const DEMO_MOOD_NOTE_PATTERN = /^Demo mood day/i;

const dateInputSchema = z.union([z.string(), z.date()]);
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

const healthUpsertSchema = z.object({
    date: dateInputSchema.optional(),
    steps: z.coerce.number().int().min(0).max(300000).optional(),
    activeMinutes: z.coerce.number().int().min(0).max(1440).optional(),
    sleepHours: z.coerce.number().min(0).max(24).optional(),
    waterLitres: z.coerce.number().min(0).max(20).optional(),
    heartRate: z.coerce.number().int().min(0).max(260).optional(),
    energyScore: z.coerce.number().min(0).max(100).optional(),
    weight: z.coerce.number().min(0).max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
}).refine(
    (value) => Object.keys(value).some((key) => key !== 'date'),
    'At least one metric field must be provided'
);

const healthUpdateSchema = z.object({
    steps: z.coerce.number().int().min(0).max(300000).optional(),
    activeMinutes: z.coerce.number().int().min(0).max(1440).optional(),
    sleepHours: z.coerce.number().min(0).max(24).optional(),
    waterLitres: z.coerce.number().min(0).max(20).optional(),
    heartRate: z.coerce.number().int().min(0).max(260).optional(),
    energyScore: z.coerce.number().min(0).max(100).optional(),
    weight: z.coerce.number().min(0).max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
}).refine(
    (value) => Object.keys(value).length > 0,
    'At least one updatable field is required'
);

function resolveWriteStatusCode(error: unknown): number {
    const candidate = error as { name?: string; code?: number; message?: string };
    if (candidate?.name === 'ValidationError' || candidate?.code === 11000 || candidate?.message === 'Invalid date') {
        return 400;
    }
    return 500;
}

// GET /api/health — all entries for user (optionally last N days)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
    const query = parseQuery(res, daysQuerySchema, req.query);
    if (!query) return;

    try {
        const todayUtc = toUtcDayStart();
        const since = shiftUtcDays(todayUtc, -(query.days - 1));
        const entries = await HealthEntry.find({
            userId: req.userId,
            date: { $gte: since },
        }).sort({ date: -1 });
        sendSuccess(res, entries);
    } catch (error: unknown) {
        console.error(error);
        sendError(res, 500, getErrorMessage(error));
    }
});

// GET /api/health/today
router.get('/today', async (req: AuthRequest, res: Response): Promise<void> => {
    const query = parseQuery(res, todayQuerySchema, req.query);
    if (!query) return;

    try {
        const { start, end } = getUtcDayRange(query.date);
        const entry = await HealthEntry.findOne({
            userId: req.userId,
            date: { $gte: start, $lt: end },
        }).sort({ updatedAt: -1, createdAt: -1 });
        sendSuccess(res, entry ?? null);
    } catch (error: unknown) {
        console.error(error);
        sendError(res, 500, getErrorMessage(error));
    }
});

// GET /api/health/history?limit=7
router.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
    const query = parseQuery(res, limitQuerySchema, req.query);
    if (!query) return;

    try {
        const todayUtc = toUtcDayStart();
        const since = shiftUtcDays(todayUtc, -(query.limit - 1));
        const entries = await HealthEntry.find({
            userId: req.userId,
            date: { $gte: since },
        }).sort({ date: -1 });
        sendSuccess(res, entries);
    } catch (error: unknown) {
        console.error(error);
        sendError(res, 500, getErrorMessage(error));
    }
});

// POST /api/health/seed-demo — creates 7 days of backdated health + mood data
router.post('/seed-demo', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

        const moods = ['happy', 'energetic', 'neutral', 'tired', 'stressed', 'sad'] as const;

        // Weekly Report window is "last 7 days before today": [today-7, today-1]
        // Keep today's Daily Log intact so dashboard avatar continues to work.
        const todayUtc = toUtcDayStart();
        const startWindow = shiftUtcDays(todayUtc, -7);

        await Promise.all([
            HealthEntry.deleteMany({
                userId,
                date: { $gte: startWindow, $lt: todayUtc },
                $or: [
                    { source: 'seed_demo' },
                    { notes: DEMO_HEALTH_NOTE_PATTERN },
                ],
            }),
            MoodEntry.deleteMany({
                userId,
                date: { $gte: startWindow, $lt: todayUtc },
                $or: [
                    { source: 'seed_demo' },
                    { notes: DEMO_MOOD_NOTE_PATTERN },
                ],
            }),
        ]);

        const healthWrites = [];
        const moodWrites = [];

        // Seed exactly 7 days ending yesterday.
        for (let offset = 7; offset >= 1; offset -= 1) {
            const date = shiftUtcDays(todayUtc, -offset);
            const dayNumber = 8 - offset; // 1..7

            healthWrites.push(
                HealthEntry.findOneAndUpdate(
                    { userId, date },
                    {
                        $set: {
                            steps: 5000 + Math.floor(Math.random() * 7000),
                            activeMinutes: 15 + Math.floor(Math.random() * 75),
                            sleepHours: +(5 + Math.random() * 4).toFixed(1),
                            waterLitres: +(1.5 + Math.random() * 1.5).toFixed(1),
                            heartRate: 60 + Math.floor(Math.random() * 30),
                            energyScore: 40 + Math.floor(Math.random() * 60),
                            weight: +(70 + Math.random() * 5).toFixed(1),
                            notes: `Demo entry day ${dayNumber}`,
                            source: 'seed_demo',
                        },
                        $setOnInsert: { userId, date },
                    },
                    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
                )
            );

            moodWrites.push(
                MoodEntry.findOneAndUpdate(
                    { userId, date },
                    {
                        $set: {
                            mood: moods[Math.floor(Math.random() * moods.length)],
                            energyLevel: 4 + Math.floor(Math.random() * 7),
                            stressLevel: 1 + Math.floor(Math.random() * 6),
                            notes: `Demo mood day ${dayNumber}`,
                            source: 'seed_demo',
                        },
                        $setOnInsert: { userId, date },
                    },
                    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
                )
            );
        }

        await Promise.all([
            Promise.all(healthWrites),
            Promise.all(moodWrites),
        ]);

        sendSuccess(res, {
            message: '7 days of demo data seeded successfully',
            healthEntries: 7,
            moodEntries: 7,
        });
    } catch (error: unknown) {
        console.error('Seed demo error:', error);
        sendError(res, 500, 'Server error during seeding');
    }
});

// DELETE /api/health/seed-demo — removes seeded demo rows only
router.delete('/seed-demo', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

        const [healthDeleted, moodDeleted] = await Promise.all([
            HealthEntry.deleteMany({
                userId,
                $or: [
                    { source: 'seed_demo' },
                    { notes: DEMO_HEALTH_NOTE_PATTERN },
                ],
            }),
            MoodEntry.deleteMany({
                userId,
                $or: [
                    { source: 'seed_demo' },
                    { notes: DEMO_MOOD_NOTE_PATTERN },
                ],
            }),
        ]);

        sendSuccess(res, {
            message: 'Seeded demo data cleared successfully',
            healthEntriesDeleted: healthDeleted.deletedCount ?? 0,
            moodEntriesDeleted: moodDeleted.deletedCount ?? 0,
        });
    } catch (error: unknown) {
        console.error('Clear seed demo error:', error);
        sendError(res, 500, 'Server error during seeded data cleanup');
    }
});

// POST /api/health — create/update today entry
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
    const input = parseBody(res, healthUpsertSchema, req.body);
    if (!input) return;

    try {
        const normalizedDate = toUtcDayStart(input.date);

        const setFields: Record<string, unknown> = {};
        if (input.steps !== undefined) setFields.steps = input.steps;
        if (input.activeMinutes !== undefined) setFields.activeMinutes = input.activeMinutes;
        if (input.sleepHours !== undefined) setFields.sleepHours = input.sleepHours;
        if (input.waterLitres !== undefined) setFields.waterLitres = input.waterLitres;
        if (input.heartRate !== undefined) setFields.heartRate = input.heartRate;
        if (input.energyScore !== undefined) setFields.energyScore = input.energyScore;
        if (input.weight !== undefined) setFields.weight = input.weight;
        if (input.notes !== undefined) setFields.notes = input.notes;
        setFields.source = 'health_api';

        const entry = await HealthEntry.findOneAndUpdate(
            { userId: req.userId, date: normalizedDate },
            {
                $set: setFields,
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
        const message = getMongooseValidationMessage(error, 'Daily health log already exists for this date');
        sendError(res, statusCode, message);
    }
});

// PUT /api/health/:id — update entry
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    const params = parseParams(res, idParamSchema, req.params);
    if (!params) return;
    const body = parseBody(res, healthUpdateSchema, req.body);
    if (!body) return;

    try {
        const entry = await HealthEntry.findOneAndUpdate(
            { _id: params.id, userId: req.userId },
            { ...body, source: 'health_api' },
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

// DELETE /api/health/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    const params = parseParams(res, idParamSchema, req.params);
    if (!params) return;

    try {
        const entry = await HealthEntry.findOneAndDelete({ _id: params.id, userId: req.userId });
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
