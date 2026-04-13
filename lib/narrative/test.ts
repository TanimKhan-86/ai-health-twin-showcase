import { NarrativeService } from './index';
import { DemoDataHelper, getDaysAgo, getToday } from '../demoData';

/**
 * Test script for Narrative Generation
 * 
 * Usage:
 * 1. Ensure database is initialized (in App or via script)
 * 2. Run this function
 */

export const testNarrativeGeneration = async () => {
    console.log('🧪 Starting Narrative Generation Test...');

    try {
        // 1. Create Demo Data
        const userId = await DemoDataHelper.populateAllDemoData();
        console.log(`Created test user: ${userId}`);

        // 2. Define Week Range (last 7 days)
        const endDate = getToday();
        const startDate = getDaysAgo(6);

        // 3. Generate Story
        console.log(`Generating story for period: ${startDate} to ${endDate}...`);
        const story = await NarrativeService.generateWeeklyStory(userId, startDate, endDate);

        // 4. Output Result
        console.log('\n✨ GENERATED NARRATIVE ✨\n');
        console.log('================================================');
        console.log(story);
        console.log('================================================\n');

        return story;
    } catch (error) {
        console.error('❌ Narrative Generation Failed:', error);
        throw error;
    }
};
