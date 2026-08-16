import { NextResponse } from 'next/server';
import { deleteTemplate, getTemplates } from '@/lib/template-store';

export const dynamic = 'force-dynamic';

export async function GET() {
    const templates = await getTemplates();
    return NextResponse.json({
        success: true,
        data: templates,
    });
}

export async function DELETE(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const url = new URL(req.url);
        const id = body.id || url.searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ID template wajib diisi.' },
                { status: 400 }
            );
        }

        await deleteTemplate(id);

        return NextResponse.json({
            success: true,
            message: 'Template berhasil dihapus.',
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal menghapus template.';
        return NextResponse.json(
            { success: false, message },
            { status: 500 }
        );
    }
}
