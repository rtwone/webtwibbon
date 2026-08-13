import { NextResponse } from 'next/server';
import { getTemplates } from '@/lib/template-store';

export const dynamic = 'force-dynamic';

export async function GET() {
    const templates = await getTemplates();
    return NextResponse.json({
        success: true,
        data: templates,
    });
}
