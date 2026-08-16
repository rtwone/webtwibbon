'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginContent />
        </Suspense>
    );
}

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get('redirect') || '/admin/dashboard';

    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            const data = await res.json();

            if (data.success) {
                router.push(redirect);
            } else {
                setError(data.message || 'Kata sandi salah.');
            }
        } catch {
            setError('Terjadi kesalahan. Coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pattern-bg flex min-h-screen items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-md"
            >
                <div className="rounded-3xl border border-border bg-white p-8 shadow-[0_20px_60px_rgba(37,99,235,0.08)]">
                    {/* Logo */}
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-2xl font-black text-white shadow-lg shadow-blue-200">
                            T
                        </div>
                        <h1 className="text-2xl font-extrabold text-ink">Twibbon Platform</h1>
                        <p className="mt-2 text-sm text-muted">Masuk sebagai Superadmin</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-ink">
                                Kode Akses / Kata Sandi
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Masukkan kata sandi"
                                className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-blue-100"
                                autoFocus
                                required
                            />
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
                            >
                                {error}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-gradient-to-r from-primary to-secondary py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:shadow-xl hover:shadow-blue-300 disabled:opacity-60"
                        >
                            {loading ? 'Memproses...' : 'Masuk'}
                        </button>
                    </form>

                </div>
            </motion.div>
        </div>
    );
}
