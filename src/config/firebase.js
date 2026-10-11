import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

let firestoreDb = null;
let isFirestoreReady = false;

try {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    // Strip surrounding quotes and properly format escaped newlines
    privateKey = privateKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'foodypay-7b82b';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@foodypay-7b82b.iam.gserviceaccount.com';

  if (projectId && clientEmail && privateKey) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    firestoreDb = admin.firestore();
    firestoreDb.settings({ ignoreUndefinedProperties: true });
    isFirestoreReady = true;
    console.log(`[Firebase] Cloud Firestore Production Database Initialized for Project: ${projectId}`);
  } else {
    console.warn('[Firebase] Firebase Admin credentials missing or incomplete in environment.');
  }
} catch (error) {
  console.error('[Firebase] Admin initialization error:', error.message);
}

export { admin, firestoreDb, isFirestoreReady };
export default firestoreDb;
