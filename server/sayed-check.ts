import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        const sayed = await User.findOne({ email: { $regex: 'sayed', $options: 'i' } }).lean();
        console.log("Raw Sayed Doc:", sayed);
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
run();
