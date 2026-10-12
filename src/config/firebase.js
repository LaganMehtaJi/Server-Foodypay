import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

let firestoreInstance = null;
let isFirebaseInitialized = false;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'foodypay-7b82b';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    // Correctly format escaped newlines in env
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (clientEmail && privateKey) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('✅ Firebase Admin SDK successfully initialized for Firestore primary storage.');
    }
    firestoreInstance = admin.firestore();
    firestoreInstance.settings({ ignoreUndefinedProperties: true });
    isFirebaseInitialized = true;
  } else {
    console.warn('⚠️ Firebase Admin credentials missing in .env. Firestore server access limited.');
  }
} catch (err) {
  console.warn('⚠️ Firebase Admin initialization notice:', err.message);
}

export const db = firestoreInstance;
export const isFirestoreReady = () => Boolean(isFirebaseInitialized && firestoreInstance);
export default admin;
