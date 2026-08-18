import { list, put, del } from '@vercel/blob';
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

const BLOB_KEY = 'templates.json';

function hasBlobConfig(): boolean {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token || !token.trim()) {
        console.warn('[template-store] BLOB_READ_WRITE_TOKEN tidak dikonfigurasi. Pastikan BLOB_READ_WRITE_TOKEN ada di .env.local');
        return false;
    }
    return true;
}

async function readTemplates(): Promise<Template[]> {
    if (!hasBlobConfig()) {
        console.warn('[readTemplates] Vercel Blob belum dikonfigurasi dengan BLOB_READ_WRITE_TOKEN');
        return [];
    }

    try {
        console.log('[readTemplates] Membaca templates dari Vercel Blob...');
        const { blobs } = await list({ prefix: BLOB_KEY });
        const targetBlob = blobs.find((b) => b.pathname === BLOB_KEY);

        if (!targetBlob) {
            console.log('[readTemplates] File templates.json belum ada di Vercel Blob');
            return [];
        }

        // PERBAIKAN: Gunakan `next: { revalidate: 0 }` alih-alih `{ cache: 'no-store' }` dan hapus query timestamp
        const res = await fetch(targetBlob.url, {
            next: { revalidate: 0 }
        });

        if (!res.ok) {
            console.error('[readTemplates] Gagal fetch templates.json:', res.status, res.statusText);
            return [];
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
        return [];
    }
}

async function writeTemplates(templates: Template[]): Promise<void> {
    if (!hasBlobConfig()) {
        throw new Error('Token Vercel Blob tidak tersedia.');
    }

    // Menggunakan allowOverwrite: true agar Vercel Blob mengizinkan menimpa file lama dengan path yang sama
    await put(BLOB_KEY, JSON.stringify(templates, null, 2), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
    });
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