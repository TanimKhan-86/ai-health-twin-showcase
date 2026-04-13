import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import HealthEntry from '../models/HealthEntry';
import MoodEntry from '../models/MoodEntry';
import { getErrorMessage, sendError, sendSuccess } from '../lib/apiResponse';

const router = Router();
router.use(authenticate);

interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    unlocked: boolean;
    unlockedAt?: Date;
}

// GET /api/achievements
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const [healthEntries, moodEntries] = await Promise.all([
            HealthEntry.find({ userId: req.userId }).sort({ date: -1 }),
            MoodEntry.find({ userId: req.userId }).sort({ date: -1 }),
        ]);

        const totalDays = healthEntries.length;
        const maxSteps = healthEntries.reduce((m, e) => Math.max(m, e.steps), 0);
        const avgSleep = totalDays
            ? healthEntries.reduce((s, e) => s + e.sleepHours, 0) / totalDays
            : 0;
        const totalWater = healthEntries.reduce((s, e) => s + e.waterLitres, 0);
        const happyDays = moodEntries.filter(e => e.mood === 'happy' || e.mood === 'energetic').length;

        const badges: Badge[] = [
            {
                id: 'first_log',
                name: 'First Step',
                description: 'Log your first health entry',
                icon: '🌱',
                unlocked: totalDays >= 1,
            },
            {
                id: 'week_warrior',
                name: 'Week Warrior',
                description: 'Log 7 days of health data',
                icon: '📅',
                unlocked: totalDays >= 7,
            },
            {
                id: 'step_master',
                name: 'Step Master',
                description: 'Hit 10,000 steps in a day',
                icon: '👟',
                unlocked: maxSteps >= 10000,
            },
            {
                id: 'sleep_champion',
                name: 'Sleep Champion',
                description: 'Average 8+ hours of sleep',
                icon: '😴',
                unlocked: avgSleep >= 8,
            },
            {
                id: 'hydration_hero',
                name: 'Hydration Hero',
                description: 'Log 2L+ of water total',
                icon: '💧',
                unlocked: totalWater >= 2,
            },
            {
                id: 'mood_booster',
                name: 'Mood Booster',
                description: 'Log 3+ happy or energetic days',
                icon: '😊',
                unlocked: happyDays >= 3,
            },
            {
                id: 'consistency_king',
                name: 'Consistency King',
                description: 'Log data for 14 days',
                icon: '👑',
                unlocked: totalDays >= 14,
            },
            {
                id: 'health_guru',
                name: 'Health Guru',
                description: 'Log data for 30 days',
                icon: '🧘',
                unlocked: totalDays >= 30,
            },
        ];

        const unlockedCount = badges.filter(b => b.unlocked).length;
        sendSuccess(res, { badges, unlockedCount, totalBadges: badges.length });
    } catch (error: unknown) {
        console.error(error);
        sendError(res, 500, getErrorMessage(error));
    }
});

export default router;
