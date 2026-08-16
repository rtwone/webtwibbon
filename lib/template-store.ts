import { promises as fs } from 'fs';
import path from 'path';
import { head, put } from '@vercel/blob';

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

const BLOB_KEY = 'templates.json';
const DATA_FILE = path.join(process.cwd(), 'data', 'templates.json');

function hasBlobConfig(): boolean {
    return Boolean(
        process.env.BLOB_READ_WRITE_TOKEN ||
        process.env.BLOB_TOKEN ||
        process.env.BLOB_STORE_ID ||
        process.env.VERCEL_OIDC_TOKEN
    );
}

async function readLocalTemplates(): Promise<Template[]> {
    try {
        const raw = await fs.readFile(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
        if (err?.code === 'ENOENT') {
            return [];
        }
        throw err;
    }
}

async function writeLocalTemplates(templates: Template[]): Promise<void> {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(templates, null, 2), 'utf8');
}

async function readTemplates(): Promise<Template[]> {
    if (!hasBlobConfig()) {
        return readLocalTemplates();
    }

    try {
        console.log('[readTemplates] Checking for templates.json in Vercel Blob...');
        let blob;
        try {
            blob = await head(BLOB_KEY);
        } catch (headErr: any) {
            if (headErr?.message?.includes('does not exist')) {
                console.log('[readTemplates] templates.json does not exist yet (first run), returning empty array');
                return [];
            }
            throw headErr;
        }

        if (!blob) {
            console.log('[readTemplates] No templates.json found, returning empty array');
            return [];
        }

        console.log('[readTemplates] Found blob, fetching content from:', blob.url);
        const res = await fetch(blob.url);
        if (!res.ok) {
            console.error('[readTemplates] Failed to fetch blob, status:', res.status);
            return [];
        }

        const raw = await res.text();
        console.log('[readTemplates] Fetched content length:', raw.length);
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error('[readTemplates] Unexpected error:', err instanceof Error ? err.message : String(err));
        return readLocalTemplates();
    }
}

async function writeTemplates(templates: Template[]): Promise<void> {
    if (!hasBlobConfig()) {
        await writeLocalTemplates(templates);
        return;
    }

    try {
        console.log('[writeTemplates] Saving', templates.length, 'templates to Vercel Blob...');
        const result = await put(BLOB_KEY, JSON.stringify(templates, null, 2), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
        });
        console.log('[writeTemplates] Successfully saved to:', result.url);
    } catch (err) {
        console.error('[writeTemplates] Error saving templates:', err instanceof Error ? err.message : String(err));
        await writeLocalTemplates(templates);
    }
}

/** Get all templates from local JSON storage, with Blob fallback when configured. */
export async function getTemplates(): Promise<Template[]> {
    const templates = await readTemplates();
    return templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Get a single template by slug. */
export async function getTemplateBySlug(slug: string): Promise<Template | null> {
    const templates = await readTemplates();
    return templates.find((template) => template.slug === slug) ?? null;
}

/** Save a template to local JSON storage, with Blob fallback when configured. */
export async function saveTemplate(template: Template): Promise<void> {
    const templates = await readTemplates();
    const index = templates.findIndex((item) => item.id === template.id);

    if (index >= 0) {
        templates[index] = template;
    } else {
        templates.unshift(template);
    }

    await writeTemplates(templates);
}

/** Delete a template from local JSON storage, with Blob fallback when configured. */
export async function deleteTemplate(id: string): Promise<void> {
    const templates = (await readTemplates()).filter((template) => template.id !== id);
    await writeTemplates(templates);
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
