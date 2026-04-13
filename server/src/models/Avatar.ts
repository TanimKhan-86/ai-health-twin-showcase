import mongoose, { Document, Schema } from 'mongoose';

export interface IAvatar extends Document {
    userId: mongoose.Types.ObjectId;
    avatarImageUrl: string;
    generationMetadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

const AvatarSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        avatarImageUrl: { type: String, required: true },
        generationMetadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

export const Avatar = mongoose.models.Avatar || mongoose.model<IAvatar>('Avatar', AvatarSchema);
