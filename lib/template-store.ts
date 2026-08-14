import { list, head, put, del } from '@vercel/blob';

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

async function readTemplates(): Promise<Template[]> {
    try {
        console.log('[readTemplates] Checking for templates.json in Vercel Blob...');
        const blob = await head(BLOB_KEY);
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
        console.error('[readTemplates] Error:', err instanceof Error ? err.message : String(err));
        return [];
    }
}

async function writeTemplates(templates: Template[]): Promise<void> {
    await put(BLOB_KEY, JSON.stringify(templates, null, 2), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
    });
}

/** Get all templates from Vercel Blob. */
export async function getTemplates(): Promise<Template[]> {
    const templates = await readTemplates();
    return templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Get a single template by slug. */
export async function getTemplateBySlug(slug: string): Promise<Template | null> {
    const templates = await readTemplates();
    return templates.find((template) => template.slug === slug) ?? null;
}

/** Save a template to Vercel Blob. */
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

/** Delete a template from Vercel Blob. */
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
