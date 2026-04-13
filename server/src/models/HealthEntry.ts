import mongoose, { Document, Schema } from 'mongoose';

export interface IHealthEntry extends Document {
    userId: mongoose.Types.ObjectId;
    date: Date;
    steps: number;
    activeMinutes: number;
    sleepHours: number;
    waterLitres: number;
    heartRate: number;
    energyScore?: number;
    weight?: number;
    notes?: string;
    source?: 'daily_log' | 'health_api' | 'seed_demo';
    createdAt: Date;
}

const HealthEntrySchema = new Schema<IHealthEntry>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        date: { type: Date, required: true },
        steps: { type: Number, default: 0, min: 0 },
        activeMinutes: { type: Number, default: 0, min: 0, max: 1440 },
        sleepHours: { type: Number, default: 0, min: 0, max: 24 },
        waterLitres: { type: Number, default: 0, min: 0 },
        heartRate: { type: Number, default: 0, min: 0 },
        energyScore: { type: Number, default: null, min: 0, max: 100 },
        weight: { type: Number, min: 0 },
        notes: { type: String, trim: true },
        source: {
            type: String,
            enum: ['daily_log', 'health_api', 'seed_demo'],
            default: 'health_api',
            index: true,
        },
    },
    { timestamps: true }
);

// One health entry per user per day (date normalized to UTC midnight by routes).
HealthEntrySchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model<IHealthEntry>('HealthEntry', HealthEntrySchema);
