import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, setAuthCookie, clearAuthCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { password } = body;

    if (!password) {
        return NextResponse.json({ success: false, message: 'Kata sandi wajib diisi.' }, { status: 400 });
    }

    if (verifyPassword(password)) {
        const res = NextResponse.json({ success: true, message: 'Login berhasil.' });
        setAuthCookie(res);
        return res;
    }

    return NextResponse.json({ success: false, message: 'Kata sandi salah.' }, { status: 401 });
}

export async function DELETE() {
    const res = NextResponse.json({ success: true, message: 'Logout berhasil.' });
    clearAuthCookie(res);
    return res;
}
