import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE } from '@/lib/auth';

export default function HomePage() {
    const cookieStore = cookies();
    const isAuthed = cookieStore.get(ADMIN_COOKIE)?.value === 'authenticated';

    if (isAuthed) {
        redirect('/admin/dashboard');
    } else {
        redirect('/login');
    }
}
