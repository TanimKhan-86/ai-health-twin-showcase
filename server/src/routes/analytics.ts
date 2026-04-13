import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import HealthEntry from '../models/HealthEntry';
import MoodEntry from '../models/MoodEntry';
import { shiftUtcDays, toUtcDayStart } from '../lib/dateUtils';
import { getErrorMessage, sendError, sendSuccess } from '../lib/apiResponse';
import { parseQuery, QUERY_LIMITS } from '../lib/validation';

const router = Router();
router.use(authenticate);

const summaryQuerySchema = z.object({
    days: z.coerce
        .number()
        .int()
        .min(QUERY_LIMITS.days.min)
        .max(QUERY_LIMITS.days.max)
        .default(7),
});

// GET /api/analytics/summary?days=7
router.get('/summary', async (req: AuthRequest, res: Response): Promise<void> => {
    const query = parseQuery(res, summaryQuerySchema, req.query);
    if (!query) return;

    try {
        const today = toUtcDayStart();
        const since = shiftUtcDays(today, -(query.days - 1));
        const tomorrow = shiftUtcDays(today, 1);

        const [healthEntries, moodEntries] = await Promise.all([
            HealthEntry.find({ userId: req.userId, date: { $gte: since, $lt: tomorrow } }).sort({ date: 1 }),
            MoodEntry.find({ userId: req.userId, date: { $gte: since, $lt: tomorrow } }).sort({ date: 1 }),
        ]);

        const count = healthEntries.length;
        const avgSteps = count ? Math.round(healthEntries.reduce((sum, entry) => sum + entry.steps, 0) / count) : 0;
        const avgSleep = count ? +(healthEntries.reduce((sum, entry) => sum + entry.sleepHours, 0) / count).toFixed(1) : 0;
        const avgWater = count ? +(healthEntries.reduce((sum, entry) => sum + entry.waterLitres, 0) / count).toFixed(1) : 0;
        const avgHR = count ? Math.round(healthEntries.reduce((sum, entry) => sum + entry.heartRate, 0) / count) : 0;

        const moodCount = moodEntries.length;
        const avgEnergy = moodCount ? +(moodEntries.reduce((sum, entry) => sum + entry.energyLevel, 0) / moodCount).toFixed(1) : 0;
        const avgStress = moodCount ? +(moodEntries.reduce((sum, entry) => sum + entry.stressLevel, 0) / moodCount).toFixed(1) : 0;

        const moodDist: Record<string, number> = {};
        moodEntries.forEach((entry) => {
            moodDist[entry.mood] = (moodDist[entry.mood] || 0) + 1;
        });

        sendSuccess(res, {
            period: { days: query.days, from: since, to: today },
            health: { count, avgSteps, avgSleep, avgWater, avgHR },
            mood: { count: moodCount, avgEnergy, avgStress, distribution: moodDist },
            healthTimeline: healthEntries,
            moodTimeline: moodEntries,
        });
    } catch (error: unknown) {
        console.error(error);
        sendError(res, 500, getErrorMessage(error));
    }
});

export default router;
