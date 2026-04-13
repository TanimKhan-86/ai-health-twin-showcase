import { WeeklyAnalytics } from '../analytics';

/**
 * Interface definition for Narrative Templates
 */

export type NarrativeCategory = 'energy' | 'emotion' | 'sleep' | 'activity' | 'correlation' | 'summary';
export type NarrativeSubCategory = 'improvement' | 'decline' | 'stable' | 'high' | 'low' | 'insight';

export interface NarrativeTemplate {
    id: string;
    category: NarrativeCategory;
    subCategory: NarrativeSubCategory;
    /**
     * Weight determines probability of selection (higher = more likely)
     * Default: 1.0
     */
    weight?: number;
    /**
     * Function to determine if this template applies to the current data
     */
    condition: (data: WeeklyAnalytics) => boolean;
    /**
     * Function to generate the narrative text
     */
    template: (data: WeeklyAnalytics, userName: string) => string;
}

/**
 * Collection of all available templates
 */
export type TemplateCollection = NarrativeTemplate[];
