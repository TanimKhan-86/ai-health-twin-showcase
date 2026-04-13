import mongoose, { Document, Schema } from 'mongoose';

export interface IWeeklyAnalysisCache extends Document {
    userId: string;
    weekKey: string; // Format: "YYYY-WW" (year + week number)
    narrative: string;
    tips: string[];
    predictedOutcome: string;
    disclaimer: string;
    createdAt: Date;
}

const WeeklyAnalysisCacheSchema = new Schema<IWeeklyAnalysisCache>({
    userId: { type: String, required: true },
    weekKey: { type: String, required: true },
    narrative: { type: String, required: true },
    tips: [{ type: String }],
    predictedOutcome: { type: String },
    disclaimer: { type: String },
    createdAt: { type: Date, default: Date.now },
});

// Ensure one cache entry per user per week
WeeklyAnalysisCacheSchema.index({ userId: 1, weekKey: 1 }, { unique: true });

export default mongoose.model<IWeeklyAnalysisCache>('WeeklyAnalysisCache', WeeklyAnalysisCacheSchema);
