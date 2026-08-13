import { NextRequest, NextResponse } from 'next/server';
import { getTemplateBySlug } from '@/lib/template-store';

export const dynamic = 'force-dynamic';

export async function GET(
    _req: NextRequest,
    { params }: { params: { slug: string } }
) {
    const template = getTemplateBySlug(params.slug);

    if (!template) {
        return NextResponse.json(
            { success: false, message: 'Template tidak ditemukan.' },
            { status: 404 }
        );
    }

    return NextResponse.json({ success: true, data: template });
}
