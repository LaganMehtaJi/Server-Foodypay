import mongoose from 'mongoose';

const FALLBACK_ATLAS_URI = 'mongodb+srv://foodypayin_db_user:zPvWNpwDprIcY0R8@cluster0.cg5h3oa.mongodb.net/foodypay?retryWrites=true&w=majority';

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URL || process.env.MONGO_URI || FALLBACK_ATLAS_URI;
  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB Backup Engine Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    if (mongoUri !== FALLBACK_ATLAS_URI) {
      console.warn(`⚠️ Primary MongoDB connection failed (${error.message}). Retrying with Cloud Atlas backup cluster...`);
      try {
        const connFallback = await mongoose.connect(FALLBACK_ATLAS_URI, {
          serverSelectionTimeoutMS: 5000,
        });
        console.log(`✅ MongoDB Backup Engine Connected via Cloud Atlas: ${connFallback.connection.host}`);
        return connFallback;
      } catch (fbErr) {
        console.warn(`⚠️ MongoDB Backup Engine Warning: ${fbErr.message}. Primary Firestore is active.`);
      }
    } else {
      console.warn(`⚠️ MongoDB Backup Engine Warning: ${error.message}. Primary Firestore is active.`);
    }
  }
};

export default connectDB;
