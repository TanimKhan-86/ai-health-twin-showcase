import { narrativeEngine } from './engine';
import { generateWeeklyAnalytics, WeeklyAnalytics } from '../analytics';
import { UserService } from '../services';

/**
 * Narrative Service
 * 
 * Public API for generating health stories.
 */

export const NarrativeService = {
    /**
     * Generate a weekly story for a user
     */
    async generateWeeklyStory(
        userId: string,
        weekStartDate: string,
        weekEndDate: string
    ): Promise<{ story: string; analytics: WeeklyAnalytics }> {
        // 1. Get User Data
        const user = await UserService.getUser(userId);
        const userName = user?.name || 'Friend';

        // 2. Analyize Health Data
        const analytics = await generateWeeklyAnalytics(userId, weekStartDate, weekEndDate);

        // 3. Generate Story
        const story = narrativeEngine.generateStory(analytics, userName);

        return { story, analytics };
    },
};
