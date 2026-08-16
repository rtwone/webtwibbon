import { promises as fs } from 'fs';
import path from 'path';
import { list, put, del } from '@vercel/blob';

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
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.trim() !== '');
}

// Fungsi pembantu untuk mencari URL lengkap templates.json di Vercel Blob
async function getBlobFileUrl(): Promise<string | null> {
    try {
        // Mencari file dengan nama templates.json di dalam storage Anda
        const { blobs } = await list({ prefix: BLOB_KEY });
        const targetBlob = blobs.find(b => b.pathname === BLOB_KEY);
        return targetBlob ? targetBlob.url : null;
    } catch (err) {
        console.error('[getBlobFileUrl] Gagal mencari berkas di Blob:', err);
        return null;
    }
}

async function readTemplates(): Promise<Template[]> {
    if (!hasBlobConfig()) {
        console.log('[readTemplates] Token Blob tidak aktif.');
        return [];
    }

    try {
        console.log('[readTemplates] Mencari lokasi templates.json di Vercel Blob...');
        const blobUrl = await getBlobFileUrl();

        if (!blobUrl) {
            console.log('[readTemplates]templates.json belum ada (unggahan pertama), mengembalikan array kosong');
            return [];
        }

        console.log('[readTemplates] Menemukan file, mengunduh data dari:', blobUrl);
        const res = await fetch(blobUrl, { cache: 'no-store' });
        if (!res.ok) {
            console.error('[readTemplates] Gagal mengunduh isi blob, status:', res.status);
            return [];
        }

        const raw = await res.text();
        if (!raw.trim()) return [];

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error('[readTemplates] Error tidak terduga:', err instanceof Error ? err.message : String(err));
        return [];
    }
}

async function writeTemplates(templates: Template[]): Promise<void> {
    if (!hasBlobConfig()) {
        console.error('[writeTemplates] Gagal menyimpan, token Blob tidak aktif.');
        return;
    }

    try {
        console.log('[writeTemplates] Menyimpan', templates.length, 'data template ke Vercel Blob...');

        // Menyimpan atau menimpa langsung file templates.json di dalam cloud Vercel Blob
        const result = await put(BLOB_KEY, JSON.stringify(templates, null, 2), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false, // Wajib FALSE agar file yang sama ditimpa dan tidak membuat file baru acak
        });

        console.log('[writeTemplates] Sukses menyimpan data ke:', result.url);
    } catch (err) {
        console.error('[writeTemplates] Gagal menyimpan ke Blob:', err instanceof Error ? err.message : String(err));
    }
}

/** Ambil seluruh template data dan urutkan berdasarkan tanggal terbaru */
export async function getTemplates(): Promise<Template[]> {
    const templates = await readTemplates();
    return templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Cari data template tunggal menggunakan teks slug */
export async function getTemplateBySlug(slug: string): Promise<Template | null> {
    const templates = await readTemplates();
    return templates.find((template) => template.slug === slug) ?? null;
}

/** Simpan atau perbarui data template twibbon */
export async function saveTemplate(template: Template): Promise<void> {
    const templates = await readTemplates();
    const index = templates.findIndex((item) => item.id === template.id);

    if (index >= 0) {
        templates[index] = template; // Mode Edit: Timpa data lama
    } else {
        templates.unshift(template); // Mode Baru: Taruh di baris paling atas
    }

    await writeTemplates(templates);
}

async function deleteUploadedAsset(imageUrl?: string): Promise<void> {
    if (!imageUrl) return;

    // Jika gambar tersimpan di cloud Vercel Blob, hapus berkasnya
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        try {
            await del(imageUrl);
            console.log('[deleteUploadedAsset] Sukses menghapus aset cloud:', imageUrl);
        } catch (err) {
            console.warn('[deleteUploadedAsset] Gagal menghapus berkas di Vercel Blob:', imageUrl, err);
        }
    }
}

/** Hapus template dari data cloud beserta aset gambarnya */
export async function deleteTemplate(id: string): Promise<void> {
    const templates = await readTemplates();
    const target = templates.find((template) => template.id === id);

    if (!target) {
        return;
    }

    const filtered = templates.filter((template) => template.id !== id);
    await writeTemplates(filtered);

    // Hapus file gambar asli dari penyimpanan biar kapasitas disk hemat
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
