import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import HealthEntry from '../models/HealthEntry';
import { toUtcDayStart } from '../lib/dateUtils';
import { getErrorMessage, sendError, sendSuccess } from '../lib/apiResponse';

const router = Router();
router.use(authenticate);

// GET /api/streak
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const entries = await HealthEntry.find({ userId: req.userId })
            .sort({ date: -1 })
            .select('date');

        if (!entries.length) {
            sendSuccess(res, { currentStreak: 0, longestStreak: 0, lastLogDate: null });
            return;
        }

        // Build streak by checking consecutive days
        const dates = entries.map(e => {
            return toUtcDayStart(e.date).getTime();
        });

        const unique = [...new Set(dates)].sort((a, b) => b - a);
        const DAY = 86400000;

        let longestStreak = 1;
        let streak = 1;

        for (let i = 1; i < unique.length; i++) {
            if (unique[i - 1] - unique[i] === DAY) {
                streak++;
                longestStreak = Math.max(longestStreak, streak);
            } else {
                streak = 1;
            }
        }

        // Count only the latest consecutive segment (from newest log backward).
        let latestSegment = 1;
        for (let i = 1; i < unique.length; i++) {
            if (unique[i - 1] - unique[i] === DAY) {
                latestSegment++;
            } else {
                break;
            }
        }

        // Check if streak is still active (last entry today or yesterday)
        const today = toUtcDayStart();
        const diffFromToday = today.getTime() - unique[0];
        const currentStreak = diffFromToday <= DAY ? latestSegment : 0;

        sendSuccess(res, {
            currentStreak,
            longestStreak,
            lastLogDate: new Date(unique[0]).toISOString(),
        });
    } catch (error: unknown) {
        console.error(error);
        sendError(res, 500, getErrorMessage(error));
    }
});

export default router;
