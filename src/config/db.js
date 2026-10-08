import mongoose from 'mongoose';

const FALLBACK_ATLAS_URI = 'mongodb+srv://foodypayin_db_user:zPvWNpwDprIcY0R8@cluster0.cg5h3oa.mongodb.net/foodypay?retryWrites=true&w=majority';

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL || FALLBACK_ATLAS_URI;
  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    if (error.message.includes('ECONNREFUSED') && mongoUri !== FALLBACK_ATLAS_URI) {
      console.warn(`Local MongoDB connection failed (${error.message}). Retrying with Cloud MongoDB Atlas...`);
      try {
        const connFallback = await mongoose.connect(FALLBACK_ATLAS_URI);
        console.log(`MongoDB Connected via Cloud Atlas: ${connFallback.connection.host}`);
        return;
      } catch (fbErr) {
        console.error(`MongoDB Cloud Connection Error: ${fbErr.message}`);
      }
    } else {
      console.error(`MongoDB Connection Error: ${error.message}`);
    }
    process.exit(1);
  }
};

export default connectDB;
