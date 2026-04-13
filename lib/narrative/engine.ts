import { WeeklyAnalytics } from '../analytics';
import { NarrativeTemplate, TemplateCollection } from './templates';
import { energyTemplates } from './generators/energy';
import { emotionTemplates } from './generators/emotion';
import { correlationTemplates } from './generators/correlations';

/**
 * Narrative Engine
 * 
 * Selects and assembles narrative templates based on data analysis.
 */

export class NarrativeEngine {
    private templates: TemplateCollection;

    constructor() {
        this.templates = [
            ...energyTemplates,
            ...emotionTemplates,
            ...correlationTemplates,
        ];
    }

    /**
     * Generate a complete weekly story
     */
    generateStory(data: WeeklyAnalytics, userName: string): string {
        const parts: string[] = [];

        // 1. Introduction / Summary
        parts.push(this.generateSection(data, userName, 'summary'));

        // 2. High Priority Insight (Correlation or Significant Trend)
        const highlight = this.generateSection(data, userName, 'correlation');
        if (highlight) parts.push(highlight);

        // 3. Energy Insight
        const energy = this.generateSection(data, userName, 'energy');
        if (energy) parts.push(energy);

        // 4. Emotion Insight
        const emotion = this.generateSection(data, userName, 'emotion');
        if (emotion) parts.push(emotion);

        // 5. Conclusion (Activity or Sleep specific if not covered)
        // For now, simpler closing
        parts.push(`Keep tracking to learn more about your unique rhythm, ${userName}.`);

        return parts.filter(p => p.length > 0).join('\n\n');
    }

    /**
     * Generate a specific section by finding the best fitting template
     */
    private generateSection(
        data: WeeklyAnalytics,
        userName: string,
        category: 'energy' | 'emotion' | 'sleep' | 'activity' | 'correlation' | 'summary'
    ): string {
        // Filter templates for this category that match conditions
        const validTemplates = this.templates.filter(
            t => t.category === category && t.condition(data)
        );

        if (validTemplates.length === 0) return '';

        // Sort by weight/priority (random selection among highest weighted could be improving)
        // For now, simple weighted random selection
        const selectedTemplate = this.selectWeightedTemplate(validTemplates);

        return selectedTemplate.template(data, userName);
    }

    /**
     * Select a template based on weights
     */
    private selectWeightedTemplate(templates: NarrativeTemplate[]): NarrativeTemplate {
        const totalWeight = templates.reduce((sum, t) => sum + (t.weight || 1.0), 0);
        let random = Math.random() * totalWeight;

        for (const template of templates) {
            random -= (template.weight || 1.0);
            if (random <= 0) {
                return template;
            }
        }
        return templates[0]; // Fallback
    }
}

// Export singleton
export const narrativeEngine = new NarrativeEngine();
