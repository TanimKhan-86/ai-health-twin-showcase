import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import HealthEntry from '../models/HealthEntry';
import MoodEntry from '../models/MoodEntry';
import { shiftUtcDays, toUtcDayStart } from '../lib/dateUtils';
import { getErrorMessage, sendError, sendSuccess } from '../lib/apiResponse';

const router = Router();
router.use(authenticate);

const MOODS = ['happy', 'energetic', 'neutral', 'tired', 'stressed', 'sad'] as const;

// POST /api/seed/demo  — creates 7 days of backdated health + mood data
router.post('/demo', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

        // Clear existing data for this user
        await Promise.all([
            HealthEntry.deleteMany({ userId }),
            MoodEntry.deleteMany({ userId }),
        ]);

        const healthDocs = [];
        const moodDocs = [];

        for (let i = 6; i >= 0; i--) {
            const date = shiftUtcDays(toUtcDayStart(), -i);

            healthDocs.push({
                userId,
                date,
                steps: 5000 + Math.floor(Math.random() * 7000),        // 5k–12k
                sleepHours: +(5 + Math.random() * 4).toFixed(1),        // 5–9 hrs
                waterLitres: +(1.5 + Math.random() * 1.5).toFixed(1),   // 1.5–3L
                heartRate: 60 + Math.floor(Math.random() * 30),          // 60–90 bpm
                weight: +(70 + Math.random() * 5).toFixed(1),
                notes: `Day ${7 - i} demo entry`,
            });

            moodDocs.push({
                userId,
                date,
                mood: MOODS[Math.floor(Math.random() * MOODS.length)],
                energyLevel: 4 + Math.floor(Math.random() * 7),   // 4–10
                stressLevel: 1 + Math.floor(Math.random() * 6),   // 1–6
                notes: `Day ${7 - i} mood`,
            });
        }

        await Promise.all([
            HealthEntry.insertMany(healthDocs),
            MoodEntry.insertMany(moodDocs),
        ]);

        sendSuccess(res, {
            message: '7 days of demo data seeded successfully',
            healthEntries: healthDocs.length,
            moodEntries: moodDocs.length,
        });
    } catch (error: unknown) {
        console.error(error);
        sendError(res, 500, getErrorMessage(error));
    }
});

export default router;
