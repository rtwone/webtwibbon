import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE } from './lib/auth';

const protectedPaths = ['/admin', '/admin/dashboard'];
const publicEditorPaths = ['/login'];

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const cookie = req.cookies.get(ADMIN_COOKIE);
    const isAuthed = cookie?.value === 'authenticated';

    // Redirect to login if accessing protected admin pages without auth
    if (protectedPaths.some((p) => pathname.startsWith(p)) && !isAuthed) {
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Redirect to admin dashboard if already logged in and visiting /login
    if (publicEditorPaths.includes(pathname) && isAuthed) {
        return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/login'],
};
