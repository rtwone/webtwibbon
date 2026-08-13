import { cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin SDK singleton (Firestore only).
 * Image storage uses Cloudinary.
 *
 * Required env vars (set in .env.local or Vercel):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY       (newline characters as \n)
 */

let app: App;
let db: Firestore;

function init() {
    if (getApps().length === 0) {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        app = initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey,
            }),
        });
    } else {
        app = getApps()[0];
    }
    db = getFirestore(app);
}

/** Lazy getter so the module doesn't crash at import time if env is missing. */
export function getDb(): Firestore {
    if (!db) init();
    return db;
}

export { app };
