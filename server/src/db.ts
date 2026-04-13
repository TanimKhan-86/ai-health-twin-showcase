import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI is not defined in .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB Atlas');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    }
};
