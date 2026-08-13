import { NextRequest, NextResponse } from 'next/server';
import { saveTemplate, getTemplates, slugify, generateId, Template } from '@/lib/template-store';
import { getBucket } from '@/lib/firebase-admin';

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

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
        if (!allowedTypes.includes(imageFile.type)) {
            return NextResponse.json(
                { success: false, message: 'Format file tidak didukung. Gunakan PNG, JPG, atau WebP.' },
                { status: 400 }
            );
        }

        // Validate file size (max 10MB)
        if (imageFile.size > 10 * 1024 * 1024) {
            return NextResponse.json(
                { success: false, message: 'Ukuran file terlalu besar. Maksimal 10MB.' },
                { status: 400 }
            );
        }

        // Generate slug
        let slug = customSlug ? slugify(customSlug) : slugify(name);

        // Ensure slug uniqueness
        const existing = await getTemplates();
        if (existing.some((t) => t.slug === slug)) {
            slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
        }

        // Upload image to Firebase Storage
        const ext = imageFile.name.split('.').pop() || 'png';
        const fileName = `templates/${slug}.${ext}`;
        const buffer = Buffer.from(await imageFile.arrayBuffer());

        const bucket = getBucket();
        const file = bucket.file(fileName);
        await file.save(buffer, {
            metadata: { contentType: imageFile.type },
            public: true,
        });

        // Construct public URL
        const bucketName = bucket.name;
        const imageUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;

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
        console.error('Template upload error:', err);
        return NextResponse.json(
            { success: false, message: 'Gagal mengupload template.' },
            { status: 500 }
        );
    }
}
