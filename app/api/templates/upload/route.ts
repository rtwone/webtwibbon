import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { saveTemplate, getTemplates, slugify, generateId, Template } from '@/lib/template-store';

export const dynamic = 'force-dynamic';
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Batas maksimal 4MB

function getAllowedMimeType(file: File): string {
    const type = file.type?.toLowerCase();
    if (type && (type === 'image/png' || type === 'image/jpeg' || type === 'image/webp')) {
        return type;
    }

    const name = file.name?.toLowerCase() || '';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.webp')) return 'image/webp';

    return type || 'application/octet-stream';
}

// Fungsi upload yang sekarang murni hanya mengirim data ke Vercel Blob
async function uploadImageToStorage(imageFile: File, slug: string): Promise<string> {
    const ext = (imageFile.name.split('.').pop() || 'png').toLowerCase();
    const fileBuffer = Buffer.from(await imageFile.arrayBuffer());

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        throw new Error('BLOB_READ_WRITE_TOKEN belum diatur di environment variables.');
    }

    // Mengunggah file gambar ke folder 'templates/' di Vercel Blob
    const blob = await put(`templates/${slug}-${Date.now()}.${ext}`, fileBuffer, {
        access: 'public',
        contentType: imageFile.type || 'image/png',
        addRandomSuffix: false,
    });

    return blob.url;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        const name = formData.get('name') as string;
        const description = (formData.get('description') as string) || '';
        const category = (formData.get('category') as string) || 'umum';
        const width = parseInt(formData.get('width') as string, 10) || 1080;
        const height = parseInt(formData.get('height') as string, 10) || 1080;
        const customSlug = (formData.get('slug') as string) || '';
        const imageFile = formData.get('image') as File | null;

        if (!name || !imageFile) {
            return NextResponse.json(
                { success: false, message: 'Nama dan gambar template wajib diisi.' },
                { status: 400 }
            );
        }

        const finalMimeType = getAllowedMimeType(imageFile);
        const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
        const isAllowedMime = allowedMimeTypes.includes(finalMimeType);

        if (!isAllowedMime) {
            return NextResponse.json(
                { success: false, message: 'Format file tidak didukung. Gunakan PNG, JPG, atau WebP.' },
                { status: 400 }
            );
        }

        if (imageFile.size > MAX_UPLOAD_BYTES) {
            return NextResponse.json(
                { success: false, message: 'Ukuran file terlalu besar. Gunakan file di bawah 4MB.' },
                { status: 400 }
            );
        }

        let slug = customSlug ? slugify(customSlug) : slugify(name);

        // Membaca data list template yang ada di Vercel Blob
        const existing = await getTemplates();

        if (existing.some((t) => t.slug === slug)) {
            slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
        }

        // Upload gambar twibbon ke Vercel Blob
        const imageUrl = await uploadImageToStorage(imageFile, slug);

        const template: Template = {
            id: generateId(),
            slug,
            name,
            description,
            thumbnail: imageUrl,
            image: imageUrl,
            category,
            width,
            height,
            active: true,
            createdAt: new Date().toISOString(),
        };

        // Menyimpan data metadata teks ke file templates.json di Vercel Blob
        await saveTemplate(template);

        return NextResponse.json({
            success: true,
            message: 'Template berhasil dibuat.',
            data: template,
        });
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
            { success: false, message: `Gagal mengupload template: ${errorMessage}` },
            { status: 500 }
        );
    }
}
