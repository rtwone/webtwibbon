'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Template } from '@/lib/template-store';

export default function AdminDashboard() {
    const router = useRouter();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUpload, setShowUpload] = useState(false);

    // Upload form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [slug, setSlug] = useState('');
    const [width, setWidth] = useState(1080);
    const [height, setHeight] = useState(1080);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState('');
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const fetchTemplates = useCallback(async () => {
        try {
            const res = await fetch('/api/templates');
            const data = await res.json();
            if (data.success) {
                setTemplates(data.data);
            }
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !imageFile) {
            showToast('error', 'Nama dan gambar template wajib diisi.');
            return;
        }

        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('description', description);
            formData.append('category', category);
            formData.append('slug', slug);
            formData.append('width', String(width));
            formData.append('height', String(height));
            formData.append('image', imageFile);

            const res = await fetch('/api/templates/upload', {
                method: 'POST',
                body: formData,
            });

            let data: any = null;
            try {
                data = await res.json();
            } catch {
                const text = await res.text();

                if (text.includes('Request Entity Too Large')) {
                    showToast('error', 'Ukuran file terlalu besar untuk upload saat ini. Gunakan file di bawah 4MB.');
                } else {
                    showToast('error', 'Server mengembalikan respons yang tidak valid. Coba file yang lebih kecil.');
                }
                return;
            }

            if (data.success) {
                showToast('success', `Template berhasil dibuat! URL: /${data.data.slug}`);
                setName('');
                setDescription('');
                setCategory('');
                setSlug('');
                setImageFile(null);
                setImagePreview('');
                setShowUpload(false);
                fetchTemplates();
            } else {
                showToast('error', data.message || 'Gagal mengupload template.');
            }
        } catch {
            showToast('error', 'Terjadi kesalahan saat upload.');
        } finally {
            setUploading(false);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/login', { method: 'DELETE' });
        router.push('/login');
    };

    const copyUrl = (slug: string) => {
        const url = `${window.location.origin}/${slug}`;
        navigator.clipboard.writeText(url);
        showToast('success', `URL disalin: ${url}`);
    };

    return (
        <div className="pattern-bg min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border bg-white/80 backdrop-blur-md">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-lg font-black text-white">
                            T
                        </div>
                        <div>
                            <p className="text-sm font-extrabold text-ink">Twibbon Platform</p>
                            <p className="text-xs text-muted">Superadmin Dashboard</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:bg-bg hover:text-ink"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-8">
                {/* Page Title */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold text-ink">Template Twibbon</h1>
                        <p className="mt-1 text-sm text-muted">Kelola semua template twibbon Anda.</p>
                    </div>
                    <button
                        onClick={() => setShowUpload(!showUpload)}
                        className="rounded-xl bg-gradient-to-r from-primary to-secondary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:shadow-xl"
                    >
                        + Upload Template
                    </button>
                </div>

                {/* Upload Form */}
                <AnimatePresence>
                    {showUpload && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-8 overflow-hidden"
                        >
                            <div className="rounded-3xl border border-border bg-white p-6 shadow-sm">
                                <h2 className="mb-5 text-lg font-bold text-ink">Upload Template Baru</h2>
                                <form onSubmit={handleUpload} className="grid gap-5 md:grid-cols-2">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="mb-1.5 block text-sm font-semibold text-ink">Nama Template *</label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="PKKMB Universitas Wiraraja 2026"
                                                className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-semibold text-ink">Deskripsi</label>
                                            <textarea
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Deskripsi singkat template..."
                                                rows={2}
                                                className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="mb-1.5 block text-sm font-semibold text-ink">Kategori</label>
                                                <input
                                                    type="text"
                                                    value={category}
                                                    onChange={(e) => setCategory(e.target.value)}
                                                    placeholder="event"
                                                    className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1.5 block text-sm font-semibold text-ink">Custom URL</label>
                                                <input
                                                    type="text"
                                                    value={slug}
                                                    onChange={(e) => setSlug(e.target.value)}
                                                    placeholder="twibbon-pkkmb"
                                                    className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="mb-1.5 block text-sm font-semibold text-ink">Width (px)</label>
                                                <input
                                                    type="number"
                                                    value={width}
                                                    onChange={(e) => setWidth(parseInt(e.target.value) || 1080)}
                                                    className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1.5 block text-sm font-semibold text-ink">Height (px)</label>
                                                <input
                                                    type="number"
                                                    value={height}
                                                    onChange={(e) => setHeight(parseInt(e.target.value) || 1080)}
                                                    className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="mb-1.5 block text-sm font-semibold text-ink">Gambar Template *</label>
                                            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 px-4 py-8 text-center transition hover:border-primary hover:bg-blue-50">
                                                {imagePreview ? (
                                                    <img src={imagePreview} alt="Preview" className="max-h-48 rounded-xl" />
                                                ) : (
                                                    <>
                                                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                                                            ⤴
                                                        </div>
                                                        <span className="text-sm font-bold text-ink">Klik untuk memilih gambar</span>
                                                        <span className="mt-1 text-xs text-muted">PNG, JPG, WebP — Maks 10MB</span>
                                                    </>
                                                )}
                                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} required />
                                            </label>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                type="submit"
                                                disabled={uploading}
                                                className="flex-1 rounded-xl bg-gradient-to-r from-primary to-secondary py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:shadow-xl disabled:opacity-60"
                                            >
                                                {uploading ? 'Mengupload...' : 'Simpan Template'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowUpload(false)}
                                                className="rounded-xl border border-border bg-white px-5 py-3 text-sm font-semibold text-muted transition hover:bg-bg"
                                            >
                                                Batal
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Templates Grid */}
                {loading ? (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="skeleton h-48 rounded-3xl" />
                        ))}
                    </div>
                ) : templates.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border bg-white p-12 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl">
                            📋
                        </div>
                        <h3 className="text-lg font-bold text-ink">Belum ada template</h3>
                        <p className="mt-2 text-sm text-muted">Klik "Upload Template" untuk membuat template twibbon pertama Anda.</p>
                    </div>
                ) : (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {templates.map((tpl, i) => (
                            <motion.div
                                key={tpl.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="group overflow-hidden rounded-3xl border border-border bg-white shadow-sm transition hover:shadow-lg"
                            >
                                <div className="relative aspect-square overflow-hidden bg-bg">
                                    <img
                                        src={tpl.image}
                                        alt={tpl.name}
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                                <div className="p-5">
                                    <h3 className="text-base font-bold text-ink">{tpl.name}</h3>
                                    <p className="mt-1 text-xs text-muted">{tpl.width} × {tpl.height} px</p>
                                    <div className="mt-3 flex items-center gap-2">
                                        <code className="flex-1 truncate rounded-lg bg-bg px-3 py-2 text-xs font-medium text-primary">
                                            /{tpl.slug}
                                        </code>
                                        <button
                                            onClick={() => copyUrl(tpl.slug)}
                                            className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-muted transition hover:bg-bg hover:text-ink"
                                        >
                                            Salin
                                        </button>
                                        <a
                                            href={`/${tpl.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                                        >
                                            Buka
                                        </a>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-6 py-3 text-sm font-semibold shadow-xl ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                            }`}
                    >
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
