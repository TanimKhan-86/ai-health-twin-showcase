import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        const collection = mongoose.connection.db!.collection('users');

        const elora = await collection.findOne({ email: 'elora.ferdaus@gmail.com' });
        if (!elora) {
            console.log("User not found!");
            process.exit(1);
        }

        console.log("Found user, checking password...");
        if (!elora.password) {
            console.log("No password found! Generating bcrypt hash for 'password123'...");
            const hashedPassword = await bcrypt.hash('password123', 12);
            await collection.updateOne(
                { _id: elora._id },
                { $set: { password: hashedPassword } }
            );
            console.log("Password successfully seeded onto existing account.");
        } else {
            console.log("User already has a password hash:", elora.password);
            // Overwrite it anyway just to be absolutely sure the user knows what to type
            console.log("Overwriting with 'password123'...");
            const hashedPassword = await bcrypt.hash('password123', 12);
            await collection.updateOne(
                { _id: elora._id },
                { $set: { password: hashedPassword } }
            );
            console.log("Password successfully reset.");
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}
run();
