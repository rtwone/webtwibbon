import { put, del } from '@vercel/blob';
import fs from 'fs/promises';
import path from 'path';

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

const BLOB_URL = 'https://umzn6iraxbcerpte.public.blob.vercel-storage.com/templates.json';

async function readTemplates(): Promise<Template[]> {
    try {
        console.log('[readTemplates] Membaca templates dari Vercel Blob...');
        
        // Fetch langsung dari URL blob dengan cache busting
        const res = await fetch(`${BLOB_URL}?t=${Date.now()}`, {
            next: { revalidate: 0 }
        });

        if (!res.ok) {
            console.error('[readTemplates] Gagal fetch templates.json:', res.status, res.statusText);
            // Fallback ke file lokal jika ada error
            return readTemplatesFromFile();
        }

        const raw = await res.text();
        if (!raw.trim()) {
            console.warn('[readTemplates] templates.json kosong');
            return [];
        }

        const parsed = JSON.parse(raw);
        const templates = Array.isArray(parsed) ? parsed : [];
        console.log(`[readTemplates] Berhasil membaca ${templates.length} template(s) dari Vercel Blob`);
        return templates;
    } catch (err) {
        console.error('[readTemplates] Error:', err instanceof Error ? err.message : String(err));
        // Fallback ke file lokal jika ada error
        return readTemplatesFromFile();
    }
}

async function readTemplatesFromFile(): Promise<Template[]> {
    try {
        console.log('[readTemplatesFromFile] Membaca templates dari file lokal...');
        const filePath = path.join(process.cwd(), 'data', 'templates.json');
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const templates = Array.isArray(parsed) ? parsed : [];
        console.log(`[readTemplatesFromFile] Berhasil membaca ${templates.length} template(s) dari file lokal`);
        return templates;
    } catch (err) {
        console.warn('[readTemplatesFromFile] Gagal membaca file lokal:', err instanceof Error ? err.message : String(err));
        return [];
    }
}

async function writeTemplates(templates: Template[]): Promise<void> {
    try {
        // Menggunakan allowOverwrite: true agar Vercel Blob mengizinkan menimpa file lama dengan path yang sama
        await put(BLOB_URL.replace('https://umzn6iraxbcerpte.public.blob.vercel-storage.com/', ''), JSON.stringify(templates, null, 2), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
            allowOverwrite: true,
        });
        console.log('[writeTemplates] Berhasil menyimpan templates ke Vercel Blob');
    } catch (err) {
        console.error('[writeTemplates] Error:', err instanceof Error ? err.message : String(err));
        throw err;
    }
}

export async function getTemplates(): Promise<Template[]> {
    const templates = await readTemplates();
    return templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getTemplateBySlug(slug: string): Promise<Template | null> {
    const templates = await readTemplates();
    return templates.find((template) => template.slug === slug) ?? null;
}

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

async function deleteUploadedAsset(imageUrl?: string): Promise<void> {
    if (!imageUrl) return;

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        try {
            await del(imageUrl);
        } catch (err) {
            console.warn('[deleteUploadedAsset] Gagal menghapus aset:', err);
        }
    }
}

export async function deleteTemplate(id: string): Promise<void> {
    const templates = await readTemplates();
    const target = templates.find((template) => template.id === id);

    if (!target) return;

    const filtered = templates.filter((template) => template.id !== id);
    await writeTemplates(filtered);

    await deleteUploadedAsset(target.image);
    if (target.thumbnail && target.thumbnail !== target.image) {
        await deleteUploadedAsset(target.thumbnail);
    }
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