import { NextRequest, NextResponse } from 'next/server';

const ADMIN_COOKIE = 'twibbon_admin_session';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

export function isAuthenticated(req: NextRequest): boolean {
    const cookie = req.cookies.get(ADMIN_COOKIE);
    return cookie?.value === 'authenticated';
}

export function setAuthCookie(res: NextResponse): void {
    res.cookies.set(ADMIN_COOKIE, 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
    });
}

export function clearAuthCookie(res: NextResponse): void {
    res.cookies.delete(ADMIN_COOKIE);
}

export function verifyPassword(password: string): boolean {
    return password === ADMIN_PASSWORD;
}

export { ADMIN_COOKIE, ADMIN_PASSWORD };
