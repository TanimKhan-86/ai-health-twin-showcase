import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    profileImage?: string;
    age?: number;
    heightCm?: number;
    weightKg?: number;
    createdAt: Date;
    comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, minlength: 6 },
        profileImage: { type: String },
        age: { type: Number },
        heightCm: { type: Number },
        weightKg: { type: Number }
    },
    { timestamps: true }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password
UserSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
    return bcrypt.compare(candidate, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
