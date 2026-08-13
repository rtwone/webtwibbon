import { cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

/**
 * Firebase Admin SDK singleton.
 *
 * Required env vars (set in .env.local or Vercel):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY       (newline characters as \n)
 *   FIREBASE_STORAGE_BUCKET    (e.g. your-project.appspot.com)
 */

let app: App;
let db: Firestore;
let storage: Storage;

function init() {
    if (getApps().length === 0) {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        app = initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey,
            }),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
    } else {
        app = getApps()[0];
    }
    db = getFirestore(app);
    storage = getStorage(app);
}

/** Lazy getters so the module doesn't crash at import time if env is missing. */
export function getDb(): Firestore {
    if (!db) init();
    return db;
}

export function getBucket() {
    if (!storage) init();
    return storage.bucket();
}

export { app };
