import { promises as fs } from 'fs';
import path from 'path';
import { head, put, del } from '@vercel/blob';

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

// Cek apakah berjalan di server Vercel produksi atau komputer lokal (localhost)
const isVercel = process.env.VERCEL === '1';

// Jika di Vercel, folder cadangan dialihkan ke '/tmp' agar tidak memicu error EROFS
const DATA_FILE = isVercel
    ? path.join('/tmp', 'data', 'templates.json')
    : path.join(process.cwd(), 'data', 'templates.json');

function hasBlobConfig(): boolean {
    // Diperketat hanya mendeteksi keberadaan token utama yang valid
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.trim() !== '');
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
    try {
        await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
        await fs.writeFile(DATA_FILE, JSON.stringify(templates, null, 2), 'utf8');
    } catch (err: any) {
        console.error('[writeLocalTemplates] Gagal menulis cadangan lokal:', err?.message);
        // Tetap diam agar aplikasi tidak crash total saat fallback lokal bermasalah
    }
}

async function readTemplates(): Promise<Template[]> {
    if (!hasBlobConfig()) {
        return readLocalTemplates();
    }

    try {
        console.log('[readTemplates] Memeriksa templates.json di Vercel Blob...');
        let blob;
        try {
            // Menggunakan fungsi head() resmi untuk mendeteksi file di Vercel Blob
            blob = await head(BLOB_KEY);
        } catch (headErr: any) {
            // Vercel Blob mengembalikan error teks jika file belum pernah dibuat sama sekali
            if (headErr?.message?.includes('not found') || headErr?.message?.includes('does not exist')) {
                console.log('[readTemplates] templates.json belum ada di Blob (unggahan pertama), mengembalikan array kosong');
                return [];
            }
            throw headErr;
        }

        if (!blob) {
            console.log('[readTemplates] Blob tidak ditemukan, mengembalikan array kosong');
            return [];
        }

        console.log('[readTemplates] Menemukan blob, mengunduh data dari:', blob.url);
        // Mengunduh konten teks JSON menggunakan fetch global
        const res = await fetch(blob.url, { cache: 'no-store' });
        if (!res.ok) {
            console.error('[readTemplates] Gagal mengunduh berkas blob, status:', res.status);
            return readLocalTemplates();
        }

        const raw = await res.text();
        if (!raw.trim()) return [];

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error('[readTemplates] Error tidak terduga, beralih ke cadangan lokal:', err instanceof Error ? err.message : String(err));
        return readLocalTemplates();
    }
}

async function writeTemplates(templates: Template[]): Promise<void> {
    if (!hasBlobConfig()) {
        await writeLocalTemplates(templates);
        return;
    }

    try {
        console.log('[writeTemplates] Menyimpan', templates.length, 'data template ke Vercel Blob...');
        const result = await put(BLOB_KEY, JSON.stringify(templates, null, 2), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false, // Menimpa file 'templates.json' yang sama tanpa membuat file duplikat acak
        });
        console.log('[writeTemplates] Sukses menyimpan data ke:', result.url);
    } catch (err) {
        console.error('[writeTemplates] Gagal menyimpan ke Blob, menggunakan cadangan lokal:', err instanceof Error ? err.message : String(err));
        await writeLocalTemplates(templates);
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
        templates[index] = template; // Timpa data jika ID sudah terdaftar (Edit Mode)
    } else {
        templates.unshift(template); // Taruh di baris paling atas jika data baru
    }

    await writeTemplates(templates);
}

async function deleteUploadedAsset(imageUrl?: string): Promise<void> {
    if (!imageUrl) return;

    // Jika gambar tersimpan di awan (Vercel Blob), hapus menggunakan fungsi del()
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        try {
            await del(imageUrl);
            console.log('[deleteUploadedAsset] Sukses menghapus aset cloud:', imageUrl);
        } catch (err) {
            console.warn('[deleteUploadedAsset] Gagal menghapus berkas di Vercel Blob:', imageUrl, err);
        }
        return;
    }

    // Jika gambar tersimpan di folder lokal (saat mode localhost development)
    if (imageUrl.startsWith('/uploads/')) {
        const localPath = path.join(process.cwd(), 'public', imageUrl.replace(/^\/+/, ''));
        try {
            await fs.unlink(localPath);
        } catch (err: any) {
            if (err?.code !== 'ENOENT') {
                throw err;
            }
        }
    }
}

/** Hapus template dari data JSON cloud beserta aset gambarnya */
export async function deleteTemplate(id: string): Promise<void> {
    const templates = await readTemplates();
    const target = templates.find((template) => template.id === id);

    if (!target) {
        return;
    }

    const filtered = templates.filter((template) => template.id !== id);
    await writeTemplates(filtered);

    // Hapus file gambar asli dari penyimpanan agar kapasitas disk tidak penuh
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
