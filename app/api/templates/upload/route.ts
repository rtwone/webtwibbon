import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { saveTemplate, getTemplates, slugify, generateId, Template } from '@/lib/template-store';

export const dynamic = 'force-dynamic';

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

        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
        if (!allowedTypes.includes(imageFile.type)) {
            return NextResponse.json(
                { success: false, message: 'Format file tidak didukung. Gunakan PNG, JPG, atau WebP.' },
                { status: 400 }
            );
        }

        if (imageFile.size > 10 * 1024 * 1024) {
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
