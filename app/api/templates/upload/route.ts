import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { saveTemplate, getTemplates, slugify, generateId, Template } from '@/lib/template-store';

export const dynamic = 'force-dynamic';

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

export async function POST(req: NextRequest) {
    try {
        console.log('[UPLOAD_DEBUG] Request started');
        const formData = await req.formData();

        const name = formData.get('name') as string;
        const description = (formData.get('description') as string) || '';
        const category = (formData.get('category') as string) || 'umum';
        const width = parseInt(formData.get('width') as string, 10) || 1080;
        const height = parseInt(formData.get('height') as string, 10) || 1080;
        const customSlug = (formData.get('slug') as string) || '';
        const imageFile = formData.get('image') as File | null;

        console.log('[UPLOAD_DEBUG] Parsed payload', {
            name,
            descriptionLength: description.length,
            category,
            width,
            height,
            slug: customSlug,
            hasImage: !!imageFile,
            imageName: imageFile?.name,
            imageType: imageFile?.type,
            imageSize: imageFile?.size,
        });

        if (!name || !imageFile) {
            console.log('[UPLOAD_DEBUG] Missing name or image file');
            return NextResponse.json(
                { success: false, message: 'Nama dan gambar template wajib diisi.' },
                { status: 400 }
            );
        }

        const finalMimeType = getAllowedMimeType(imageFile);
        const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
        const isAllowedMime = allowedMimeTypes.includes(finalMimeType);

        console.log('[UPLOAD_DEBUG] MIME validation', { rawType: imageFile.type, inferredType: finalMimeType, isAllowedMime });

        if (!isAllowedMime) {
            console.log('[UPLOAD_DEBUG] File type rejected');
            return NextResponse.json(
                { success: false, message: 'Format file tidak didukung. Gunakan PNG, JPG, atau WebP.' },
                { status: 400 }
            );
        }

        if (imageFile.size > 10 * 1024 * 1024) {
            console.log('[UPLOAD_DEBUG] File size rejected', { size: imageFile.size });
            return NextResponse.json(
                { success: false, message: 'Ukuran file terlalu besar. Maksimal 10MB.' },
                { status: 400 }
            );
        }

        let slug = customSlug ? slugify(customSlug) : slugify(name);
        const existing = await getTemplates();

        if (existing.some((t) => t.slug === slug)) {
            slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
        }

        const ext = (imageFile.name.split('.').pop() || 'png').toLowerCase();
        const safeFileName = `${slug}.${ext}`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await fs.mkdir(uploadDir, { recursive: true });

        const fullPath = path.join(uploadDir, safeFileName);
        const fileBuffer = Buffer.from(await imageFile.arrayBuffer());
        await fs.writeFile(fullPath, fileBuffer);

        const imageUrl = `/uploads/${safeFileName}`;

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

        await saveTemplate(template);

        return NextResponse.json({
            success: true,
            message: 'Template berhasil dibuat.',
            data: template,
        });
    } catch (err) {
        console.error('❌ Template upload error:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
            { success: false, message: `Gagal mengupload template: ${errorMessage}` },
            { status: 500 }
        );
    }
}
