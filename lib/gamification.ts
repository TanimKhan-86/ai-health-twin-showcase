import { getStreak, getTodayHealth } from './api/auth';

/**
 * Gamification Service — MongoDB version
 * Checks achievements client-side using live API data.
 * Unlocked state is stored in-memory per session (no separate DB collection needed).
 */

export const BADGES = [
    {
        id: 'first_step',
        name: 'First Step',
        description: 'Log your first health entry.',
        icon: '👣',
        category: 'milestone',
    },
    {
        id: 'streak_3',
        name: 'Consistency Is Key',
        description: 'Maintain a 3-day streak.',
        icon: '🔥',
        category: 'consistency',
    },
    {
        id: 'streak_7',
        name: 'Week Warrior',
        description: 'Maintain a 7-day streak.',
        icon: '📅',
        category: 'consistency',
    },
    {
        id: 'steps_10k',
        name: 'Marathoner',
        description: 'Walk 10,000 steps in a single day.',
        icon: '🏃',
        category: 'improvement',
    },
    {
        id: 'sleep_8h',
        name: 'Sleeping Beauty',
        description: 'Get a full 8 hours of sleep.',
        icon: '😴',
        category: 'improvement',
    },
    {
        id: 'energy_master',
        name: 'High Energy',
        description: 'Reach an energy score of 90+.',
        icon: '⚡',
        category: 'milestone',
    },
];

export const GamificationService = {
    /**
     * Check which badges are unlocked based on live MongoDB data.
     * Returns the list of badges with isUnlocked status.
     */
    async checkAchievements(_userId: string): Promise<void> {
        // No-op: badge progress is computed in getBadgeProgress()
    },

    /**
     * Get all badge definitions with unlocked status derived from
     * the user's real streak and today's health entry (from MongoDB).
     */
    async getBadgeProgress(_userId: string) {
        try {
            const [streakData, todayHealth] = await Promise.all([
                getStreak(),
                getTodayHealth(),
            ]);

            const currentStreak = streakData?.currentStreak ?? 0;
            const steps = todayHealth?.steps ?? 0;
            const sleepHours = todayHealth?.sleepHours ?? 0;
            const energyScore = todayHealth?.energyScore ?? 0;
            const hasLoggedToday = todayHealth !== null;

            return BADGES.map(badge => {
                let isUnlocked = false;
                switch (badge.id) {
                    case 'first_step': isUnlocked = hasLoggedToday; break;
                    case 'streak_3': isUnlocked = currentStreak >= 3; break;
                    case 'streak_7': isUnlocked = currentStreak >= 7; break;
                    case 'steps_10k': isUnlocked = steps >= 10000; break;
                    case 'sleep_8h': isUnlocked = sleepHours >= 8; break;
                    case 'energy_master': isUnlocked = energyScore >= 90; break;
                }
                return { ...badge, isUnlocked };
            });
        } catch (e: unknown) {
            console.error('[Gamification] Failed to load badge progress:', e);
            return BADGES.map(badge => ({ ...badge, isUnlocked: false }));
        }
    },
};
