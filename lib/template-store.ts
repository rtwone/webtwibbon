import { getDb } from './firebase-admin';

export interface Template {
    id: string;
    slug: string;
    name: string;
    description: string;
    thumbnail: string;
    image: string;
    category: string;
    width: number;
    height: number;
    active: boolean;
    createdAt: string;
}

const COLLECTION = 'templates';

/** Get all templates from Firestore. */
export async function getTemplates(): Promise<Template[]> {
    const db = getDb();
    const snap = await db.collection(COLLECTION).orderBy('createdAt', 'desc').get();
    return snap.docs.map((doc) => doc.data() as Template);
}

/** Get a single template by slug. */
export async function getTemplateBySlug(slug: string): Promise<Template | null> {
    const db = getDb();
    const snap = await db.collection(COLLECTION).where('slug', '==', slug).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].data() as Template;
}

/** Save a template to Firestore. */
export async function saveTemplate(template: Template): Promise<void> {
    const db = getDb();
    await db.collection(COLLECTION).doc(template.id).set(template);
}

/** Delete a template from Firestore. */
export async function deleteTemplate(id: string): Promise<void> {
    const db = getDb();
    await db.collection(COLLECTION).doc(id).delete();
}

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

export function generateId(): string {
    return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
