import { NextRequest, NextResponse } from 'next/server';
import { getTemplates } from '@/lib/template-store';

export const dynamic = 'force-dynamic';

export async function GET() {
    const templates = getTemplates();
    return NextResponse.json({
        success: true,
        data: templates,
    });
}
