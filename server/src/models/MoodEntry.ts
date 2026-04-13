import mongoose, { Document, Schema } from 'mongoose';

export type MoodType = 'happy' | 'sad' | 'stressed' | 'tired' | 'energetic' | 'neutral' | 'calm' | 'anxious' | 'excited';

export interface IMoodEntry extends Document {
    userId: mongoose.Types.ObjectId;
    date: Date;
    mood: MoodType;
    energyLevel: number;   // 1–10
    stressLevel: number;   // 1–10
    notes?: string;
    source?: 'daily_log' | 'mood_api' | 'seed_demo';
    createdAt: Date;
}

const MoodEntrySchema = new Schema<IMoodEntry>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        date: { type: Date, required: true },
        mood: {
            type: String,
            enum: ['happy', 'sad', 'stressed', 'tired', 'energetic', 'neutral', 'calm', 'anxious', 'excited'],
            required: true,
        },
        energyLevel: { type: Number, required: true, min: 1, max: 10 },
        stressLevel: { type: Number, required: true, min: 1, max: 10 },
        notes: { type: String, trim: true },
        source: {
            type: String,
            enum: ['daily_log', 'mood_api', 'seed_demo'],
            default: 'mood_api',
            index: true,
        },
    },
    { timestamps: true }
);

// One mood entry per user per day (date normalized to UTC midnight by routes).
MoodEntrySchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model<IMoodEntry>('MoodEntry', MoodEntrySchema);
