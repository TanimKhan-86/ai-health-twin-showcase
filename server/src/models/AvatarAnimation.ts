import mongoose, { Document, Schema } from 'mongoose';

export type StateType = 'happy' | 'sad' | 'sleepy' | 'calm' | 'tired';

export interface IAvatarAnimation extends Document {
    userId: mongoose.Types.ObjectId;
    stateType: StateType;
    videoUrl: string;
    duration?: number;
    quality?: 'high' | 'standard';
    loopOptimized?: boolean;
    circularOptimized?: boolean;
    generationMetadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

const AvatarAnimationSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        stateType: {
            type: String,
            enum: ['happy', 'sad', 'sleepy', 'calm', 'tired'],
            required: true,
        },
        videoUrl: { type: String, required: true },
        duration: { type: Number },
        quality: { type: String, enum: ['high', 'standard'], default: 'high' },
        loopOptimized: { type: Boolean, default: true },
        circularOptimized: { type: Boolean, default: true },
        generationMetadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

// Compound index to quickly find a specific user's specific state
AvatarAnimationSchema.index({ userId: 1, stateType: 1 }, { unique: true });

export const AvatarAnimation = mongoose.models.AvatarAnimation || mongoose.model<IAvatarAnimation>('AvatarAnimation', AvatarAnimationSchema);
