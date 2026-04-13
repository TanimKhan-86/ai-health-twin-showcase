import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import HealthEntry from '../models/HealthEntry';
import MoodEntry from '../models/MoodEntry';
import { toUtcDayStart } from '../lib/dateUtils';
import { getMongooseValidationMessage, sendError, sendSuccess } from '../lib/apiResponse';
import { parseBody } from '../lib/validation';

const router = Router();
router.use(authenticate);

const moodSchema = z.enum(['happy', 'sad', 'stressed', 'tired', 'energetic', 'neutral', 'calm', 'anxious', 'excited']);

const dailyLogSaveSchema = z.object({
    date: z.union([z.string(), z.date()]).optional(),
    steps: z.coerce.number().int().min(0).max(300000).optional(),
    activeMinutes: z.coerce.number().int().min(0).max(1440).optional(),
    sleepHours: z.coerce.number().min(0).max(24).optional(),
    waterLitres: z.coerce.number().min(0).max(20).optional(),
    heartRate: z.coerce.number().int().min(0).max(260).optional(),
    energyScore: z.coerce.number().min(0).max(100).optional(),
    weight: z.coerce.number().min(0).max(500).optional(),
    healthNotes: z.string().trim().max(2000).optional(),
    mood: moodSchema,
    energyLevel: z.coerce.number().int().min(1).max(10),
    stressLevel: z.coerce.number().int().min(1).max(10),
    moodNotes: z.string().trim().max(2000).optional(),
}).refine((value) => (
    value.steps !== undefined
    || value.activeMinutes !== undefined
    || value.sleepHours !== undefined
    || value.waterLitres !== undefined
    || value.heartRate !== undefined
    || value.energyScore !== undefined
    || value.weight !== undefined
    || value.healthNotes !== undefined
), 'At least one health field must be provided');

function resolveWriteStatusCode(error: unknown): number {
    const candidate = error as { name?: string; code?: number; message?: string };
    if (candidate?.name === 'ValidationError' || candidate?.code === 11000 || candidate?.message === 'Invalid date') {
        return 400;
    }
    return 500;
}

// POST /api/daily-log
// Atomically saves health + mood for the same day.
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
    const input = parseBody(res, dailyLogSaveSchema, req.body);
    if (!input) return;
    const userId = req.userId;
    if (!userId) {
        sendError(res, 401, 'Unauthorized');
        return;
    }

    const normalizedDate = toUtcDayStart(input.date);
    const healthSet: Record<string, unknown> = {};

    if (input.steps !== undefined) healthSet.steps = input.steps;
    if (input.activeMinutes !== undefined) healthSet.activeMinutes = input.activeMinutes;
    if (input.sleepHours !== undefined) healthSet.sleepHours = input.sleepHours;
    if (input.waterLitres !== undefined) healthSet.waterLitres = input.waterLitres;
    if (input.heartRate !== undefined) healthSet.heartRate = input.heartRate;
    if (input.energyScore !== undefined) healthSet.energyScore = input.energyScore;
    if (input.weight !== undefined) healthSet.weight = input.weight;
    if (input.healthNotes !== undefined) healthSet.notes = input.healthNotes;
    healthSet.source = 'daily_log';

    const moodSet: Record<string, unknown> = {
        mood: input.mood,
        energyLevel: input.energyLevel,
        stressLevel: input.stressLevel,
        source: 'daily_log',
    };
    if (input.moodNotes !== undefined) moodSet.notes = input.moodNotes;

    const session = await mongoose.startSession();
    let savedHealth: Awaited<ReturnType<typeof HealthEntry.findOneAndUpdate>> | null = null;
    let savedMood: Awaited<ReturnType<typeof MoodEntry.findOneAndUpdate>> | null = null;

    try {
        await session.withTransaction(async () => {
            savedHealth = await HealthEntry.findOneAndUpdate(
                { userId, date: normalizedDate },
                {
                    $set: healthSet,
                    $setOnInsert: {
                        userId,
                        date: normalizedDate,
                    },
                },
                {
                    session,
                    new: true,
                    upsert: true,
                    runValidators: true,
                    setDefaultsOnInsert: true,
                }
            );

            savedMood = await MoodEntry.findOneAndUpdate(
                { userId, date: normalizedDate },
                {
                    $set: moodSet,
                    $setOnInsert: {
                        userId,
                        date: normalizedDate,
                    },
                },
                {
                    session,
                    new: true,
                    upsert: true,
                    runValidators: true,
                    setDefaultsOnInsert: true,
                }
            );
        });
    } catch (error: unknown) {
        const statusCode = resolveWriteStatusCode(error);
        const message = getMongooseValidationMessage(error, 'Failed to save daily log');
        sendError(res, statusCode, message);
        return;
    } finally {
        await session.endSession();
    }

    if (!savedHealth || !savedMood) {
        sendError(res, 500, 'Daily log save failed');
        return;
    }

    sendSuccess(res, {
        date: normalizedDate.toISOString().slice(0, 10),
        health: savedHealth,
        mood: savedMood,
    });
});

export default router;
