'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Template } from '@/lib/template-store';

// Fabric.js types are loose in v5
type FabricCanvas = any;
type FabricImage = any;

interface ToastState {
    type: 'success' | 'error' | 'info';
    message: string;
}

export default function TwibbonEditor({ template }: { template: Template }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<FabricCanvas | null>(null);
    const userImageRef = useRef<FabricImage | null>(null);
    const templateImageRef = useRef<FabricImage | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pointerHandlersRef = useRef<{ down?: any; move?: any; up?: any }>({});
    const fallbackDragRef = useRef<{ dragging: boolean; target: any; offsetX: number; offsetY: number }>({ dragging: false, target: null, offsetX: 0, offsetY: 0 });

    const [zoom, setZoom] = useState(100);
    const [rotation, setRotation] = useState(0);
    const [hasImage, setHasImage] = useState(false);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [toast, setToast] = useState<ToastState | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [debugMode] = useState(() => typeof window !== 'undefined' && window.location.search.includes('debug=1'));
    const [debugEvents, setDebugEvents] = useState<string[]>([]);

    const showToast = (type: ToastState['type'], message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    // Initialize Fabric.js canvas
    useEffect(() => {
        let cancelled = false;

        async function initCanvas() {
            if (!canvasRef.current || cancelled) return;

            try {
                console.log('[TwibbonEditor] initCanvas start', { src: template.image });
                const fabricModule = await import('fabric');
                const fabric = (fabricModule as any).fabric || (fabricModule as any).default || fabricModule;
                console.log('[TwibbonEditor] fabric loaded', typeof fabric.Canvas, typeof fabric.Image);

                // Ensure we have a canvas element. If ref isn't mounted yet, create one dynamically inside the container.
                let canvasEl: HTMLCanvasElement | null = canvasRef.current;
                if (!canvasEl) {
                    const parent = document.querySelector('[data-twibbon-canvas]');
                    if (parent) {
                        canvasEl = document.createElement('canvas');
                        canvasEl.width = 500;
                        canvasEl.height = 500;
                        canvasEl.className = 'mx-auto block max-w-full max-h-full';
                        parent.appendChild(canvasEl);
                    }
                }

                if (!canvasEl) {
                    console.warn('[TwibbonEditor] No canvas element available to init');
                    return;
                }

                const canvas = new fabric.Canvas(canvasEl, {
                    width: 500,
                    height: 500,
                    backgroundColor: 'transparent',
                    selection: true,
                    preserveObjectStacking: true,
                });

                // Ensure touch/drag gestures go to canvas
                try {
                    if (canvas.upperCanvasEl) canvas.upperCanvasEl.style.touchAction = 'none';
                } catch (e) { }

                // Attach raw pointer event listeners to the upperCanvasEl so we can detect pointerdown/up
                try {
                    if (canvas.upperCanvasEl) {
                        const upEl = canvas.upperCanvasEl as HTMLElement;
                        const downHandler = (ev: PointerEvent) => {
                            try { (window as any).__twibbonDebug = (window as any).__twibbonDebug || []; (window as any).__twibbonDebug.push('pointerdown buttons=' + (ev.buttons || 0)); } catch (e) { }
                        };
                        const moveHandler = (ev: PointerEvent) => {
                            try { (window as any).__twibbonDebug = (window as any).__twibbonDebug || []; (window as any).__twibbonDebug.push('pointermove buttons=' + (ev.buttons || 0)); } catch (e) { }
                        };
                        const upHandler = (ev: PointerEvent) => {
                            try { (window as any).__twibbonDebug = (window as any).__twibbonDebug || []; (window as any).__twibbonDebug.push('pointerup buttons=' + (ev.buttons || 0)); } catch (e) { }
                        };

                        upEl.addEventListener('pointerdown', downHandler, { passive: true });
                        upEl.addEventListener('pointermove', moveHandler, { passive: true });
                        upEl.addEventListener('pointerup', upHandler, { passive: true });

                        pointerHandlersRef.current.down = downHandler;
                        pointerHandlersRef.current.move = moveHandler;
                        pointerHandlersRef.current.up = upHandler;
                    }
                } catch (e) { console.warn('[TwibbonEditor] attach pointer handlers failed', e); }

                // Document-level fallback: try to detect targets and move them if Fabric doesn't receive pointerdown
                try {
                    const docDown = (ev: PointerEvent) => {
                        try {
                            const canvas = fabricCanvasRef.current;
                            if (!canvas) return;
                            // only act if pointer is inside canvas container
                            const rect = canvas.upperCanvasEl.getBoundingClientRect();
                            if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;
                            const target = canvas.findTarget(ev, true);
                            if (target && target !== templateImageRef.current) {
                                // hide controls/selection while dragging
                                (target as any).__twibbonPrev = { selectable: target.selectable, hasControls: target.hasControls, hasBorders: target.hasBorders };
                                try { target.set({ selectable: false, hasControls: false, hasBorders: false }); } catch (e) { }
                                canvas.requestRenderAll();
                                const pointer = canvas.getPointer(ev);
                                const offX = pointer.x - (target.left || 0);
                                const offY = pointer.y - (target.top || 0);
                                fallbackDragRef.current = { dragging: true, target, offsetX: offX, offsetY: offY };
                                try { (window as any).__twibbonDebug = (window as any).__twibbonDebug || []; (window as any).__twibbonDebug.push('doc:pointerdown found target'); } catch (e) { }
                            }
                        } catch (e) { /* ignore */ }
                    };

                    const docMove = (ev: PointerEvent) => {
                        try {
                            const canvas = fabricCanvasRef.current;
                            if (!canvas) return;
                            if (!fallbackDragRef.current.dragging || !fallbackDragRef.current.target) return;
                            const pointer = canvas.getPointer(ev);
                            const t = fallbackDragRef.current.target;
                            t.set({ left: pointer.x - fallbackDragRef.current.offsetX, top: pointer.y - fallbackDragRef.current.offsetY });
                            if (typeof t.setCoords === 'function') t.setCoords();
                            canvas.requestRenderAll();
                        } catch (e) { /* ignore */ }
                    };

                    const docUp = (ev: PointerEvent) => {
                        try {
                            if (fallbackDragRef.current.dragging) {
                                const t = fallbackDragRef.current.target;
                                // restore previous control state but don't auto-select (so no selector appears)
                                try {
                                    const prev = (t as any).__twibbonPrev;
                                    if (prev) t.set({ selectable: prev.selectable, hasControls: prev.hasControls, hasBorders: prev.hasBorders });
                                } catch (e) { }
                                fallbackDragRef.current.dragging = false;
                                fallbackDragRef.current.target = null;
                                try { (window as any).__twibbonDebug = (window as any).__twibbonDebug || []; (window as any).__twibbonDebug.push('doc:pointerup'); } catch (e) { }
                                fabricCanvasRef.current?.requestRenderAll();
                            }
                        } catch (e) { /* ignore */ }
                    };

                    document.addEventListener('pointerdown', docDown, { passive: true });
                    document.addEventListener('pointermove', docMove, { passive: true });
                    document.addEventListener('pointerup', docUp, { passive: true });

                    // store on ref so we can remove later
                    (pointerHandlersRef.current as any).docDown = docDown;
                    (pointerHandlersRef.current as any).docMove = docMove;
                    (pointerHandlersRef.current as any).docUp = docUp;
                } catch (e) { console.warn('[TwibbonEditor] attach document fallback handlers failed', e); }

                // Cursor + UX tweaks for direct manipulation
                canvas.defaultCursor = 'grab';
                canvas.hoverCursor = 'grab';
                canvas.on('mouse:down', () => (canvas.defaultCursor = 'grabbing'));
                canvas.on('mouse:up', () => (canvas.defaultCursor = 'grab'));

                // Keep selection and interaction predictable
                canvas.on('selection:created', (e: any) => {
                    const obj = e.selected && e.selected[0] ? e.selected[0] : e.target;
                    if (obj) {
                        obj.set({ selectable: true, evented: true });
                        fabricCanvasRef.current?.requestRenderAll();
                    }
                });
                canvas.on('selection:updated', (e: any) => {
                    const obj = e.selected && e.selected[0] ? e.selected[0] : e.target;
                    if (obj) {
                        obj.set({ selectable: true, evented: true });
                        fabricCanvasRef.current?.requestRenderAll();
                    }
                });
                canvas.on('object:moving', (e: any) => {
                    // When object is moving, keep user state and update coords
                    setHasImage(true);
                    const obj = e.target;
                    if (obj && typeof obj.setCoords === 'function') obj.setCoords();
                });

                // Manual drag fallback (in case built-in dragging is blocked)
                let manualDrag = { dragging: false, target: null as any };
                canvas.on('mouse:down', (opt: any) => {
                    const evt = opt.e;
                    const target = opt.target;
                    try { (window as any).__twibbonDebug = (window as any).__twibbonDebug || []; (window as any).__twibbonDebug.push('mouse:down target=' + (target ? (target.type || target.constructor?.name) : 'none')); } catch (e) { }
                    if (target && target !== templateImageRef.current) {
                        // hide controls/selection while dragging
                        (target as any).__twibbonPrev = { selectable: target.selectable, hasControls: target.hasControls, hasBorders: target.hasBorders };
                        try { target.set({ selectable: false, hasControls: false, hasBorders: false }); } catch (e) { }
                        canvas.requestRenderAll();

                        manualDrag.dragging = true;
                        manualDrag.target = target;
                        canvas.selection = false;
                    }
                });

                canvas.on('mouse:move', (opt: any) => {
                    try { (window as any).__twibbonDebug = (window as any).__twibbonDebug || []; (window as any).__twibbonDebug.push('mouse:move'); } catch (e) { }
                    if (!manualDrag.dragging || !manualDrag.target) return;
                    const pointer = canvas.getPointer(opt.e);
                    try {
                        const t = manualDrag.target;
                        const w = (t.width || t._element?.width) * (t.scaleX || 1);
                        const h = (t.height || t._element?.height) * (t.scaleY || 1);
                        t.set({ left: pointer.x - w / 2, top: pointer.y - h / 2 });
                        canvas.requestRenderAll();
                    } catch (err) {
                        // ignore
                    }
                });

                canvas.on('mouse:up', () => {
                    try { (window as any).__twibbonDebug = (window as any).__twibbonDebug || []; (window as any).__twibbonDebug.push('mouse:up'); } catch (e) { }
                    if (manualDrag.dragging) {
                        const t = manualDrag.target;
                        try {
                            const prev = (t as any).__twibbonPrev;
                            if (prev) t.set({ selectable: prev.selectable, hasControls: prev.hasControls, hasBorders: prev.hasBorders });
                        } catch (e) { }
                        manualDrag.dragging = false;
                        manualDrag.target = null;
                        canvas.selection = true;
                        fabricCanvasRef.current?.requestRenderAll();
                    }
                });

                fabricCanvasRef.current = canvas;

                // Load template image as overlay (top layer)
                const templateImg = await loadImage(template.image);
                console.log('[TwibbonEditor] template image loaded', { width: templateImg.width, height: templateImg.height });
                const tplObj = new fabric.Image(templateImg, {
                    selectable: false,
                    evented: false,
                    left: 0,
                    top: 0,
                    scaleX: 500 / templateImg.width,
                    scaleY: 500 / templateImg.height,
                });

                canvas.add(tplObj);
                templateImageRef.current = tplObj;

                console.log('[TwibbonEditor] template object added to canvas');
                setLoading(false);
            } catch (err) {
                console.error('Canvas init error:', err);
                showToast('error', 'Gagal memuat template. Refresh halaman.');
                setLoading(false);
            }
        }

        initCanvas();

        return () => {
            cancelled = true;
            if (fabricCanvasRef.current) {
                try {
                    const upEl = (fabricCanvasRef.current as any).upperCanvasEl as HTMLElement | undefined;
                    if (upEl) {
                        if (pointerHandlersRef.current.down) upEl.removeEventListener('pointerdown', pointerHandlersRef.current.down as EventListener);
                        if (pointerHandlersRef.current.move) upEl.removeEventListener('pointermove', pointerHandlersRef.current.move as EventListener);
                        if (pointerHandlersRef.current.up) upEl.removeEventListener('pointerup', pointerHandlersRef.current.up as EventListener);
                    }
                } catch (e) { /* ignore */ }
                try {
                    // remove document fallback handlers if present
                    if ((pointerHandlersRef.current as any).docDown) document.removeEventListener('pointerdown', (pointerHandlersRef.current as any).docDown as EventListener);
                    if ((pointerHandlersRef.current as any).docMove) document.removeEventListener('pointermove', (pointerHandlersRef.current as any).docMove as EventListener);
                    if ((pointerHandlersRef.current as any).docUp) document.removeEventListener('pointerup', (pointerHandlersRef.current as any).docUp as EventListener);
                } catch (e) { /* ignore */ }
                fabricCanvasRef.current.dispose();
                fabricCanvasRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [template.image]);

    // Poll window.__twibbonDebug into React state when debugMode is active
    useEffect(() => {
        if (!debugMode) return;
        let mounted = true;
        const id = setInterval(() => {
            try {
                // @ts-ignore
                const arr = (window as any).__twibbonDebug || [];
                if (mounted) setDebugEvents(Array.isArray(arr) ? arr.slice(-200) : []);
            } catch (e) {
                // ignore
            }
        }, 300);
        return () => {
            mounted = false;
            clearInterval(id);
        };
    }, [debugMode]);

    // Load image helper
    const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    };

    // Handle file upload
    const handleFileSelect = useCallback(async (file: File) => {
        if (!file) return;

        // Validate type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            showToast('error', 'Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.');
            return;
        }

        // Validate size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            showToast('error', 'Ukuran file terlalu besar. Maksimal 10MB.');
            return;
        }

        try {
            const fabricModule = await import('fabric');
            const fabric = (fabricModule as any).fabric || (fabricModule as any).default || fabricModule;
            const reader = new FileReader();

            reader.onload = async (e) => {
                if (!e.target?.result || !fabricCanvasRef.current) return;

                const imgEl = await loadImage(e.target.result as string);

                // Remove existing user image
                if (userImageRef.current) {
                    fabricCanvasRef.current.remove(userImageRef.current);
                }

                // Calculate fit: cover the canvas area
                const canvasSize = 500;
                const scale = Math.max(canvasSize / imgEl.width, canvasSize / imgEl.height);

                const imgObj = new fabric.Image(imgEl, {
                    selectable: true,
                    evented: true,
                    hasBorders: true,
                    hasControls: true,
                    centeredScaling: true,
                    cornerStyle: 'circle',
                    cornerSize: 10,
                    padding: 8,
                    left: 0,
                    top: 0,
                    originX: 'left',
                    originY: 'top',
                    perPixelTargetFind: true,
                    scaleX: scale,
                    scaleY: scale,
                    lockMovementX: false,
                    lockMovementY: false,
                    lockRotation: false,
                    lockScalingX: false,
                    lockScalingY: false,
                });

                // Center the image
                imgObj.set({
                    left: (canvasSize - imgEl.width * scale) / 2,
                    top: (canvasSize - imgEl.height * scale) / 2,
                });

                fabricCanvasRef.current.add(imgObj);

                // Place user image below template overlay but above background
                fabricCanvasRef.current.sendToBack(imgObj);

                // Ensure controls are visible and object movable
                imgObj.setControlsVisibility({
                    mt: true,
                    mb: true,
                    ml: true,
                    mr: true,
                    tl: true,
                    tr: true,
                    bl: true,
                    br: true,
                    mtr: true,
                });

                imgObj.on('mousedown', () => {
                    fabricCanvasRef.current?.setActiveObject(imgObj);
                });

                // Update object coords after adding so interactions work reliably
                if (typeof imgObj.setCoords === 'function') imgObj.setCoords();

                // Make the uploaded image active so the user can immediately drag/scale/rotate it
                fabricCanvasRef.current.setActiveObject(imgObj);
                fabricCanvasRef.current.requestRenderAll();

                userImageRef.current = imgObj;
                setHasImage(true);
                setZoom(100);
                setRotation(0);

                showToast('success', 'Foto berhasil diunggah! Geser untuk menyesuaikan posisi.');
            };

            reader.readAsDataURL(file);
        } catch (err) {
            console.error('Upload error:', err);
            showToast('error', 'Gagal memproses foto. Coba lagi.');
        }
    }, []);

    // File input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
        e.target.value = '';
    };

    // Drag & drop
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileSelect(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    // Zoom control
    const handleZoom = (value: number) => {
        setZoom(value);
        if (!userImageRef.current) return;

        const fabricModule = require('fabric');
        const fabric = fabricModule.fabric || fabricModule.default || fabricModule;
        const baseScale = userImageRef.current._element
            ? Math.max(500 / userImageRef.current._element.width, 500 / userImageRef.current._element.height)
            : 1;
        const newScale = baseScale * (value / 100);

        userImageRef.current.set({
            scaleX: newScale,
            scaleY: newScale,
        });

        // Re-center
        const canvasSize = 500;
        const elWidth = userImageRef.current._element?.width || 0;
        const elHeight = userImageRef.current._element?.height || 0;
        userImageRef.current.set({
            left: (canvasSize - elWidth * newScale) / 2,
            top: (canvasSize - elHeight * newScale) / 2,
        });

        fabricCanvasRef.current?.renderAll();
    };

    // Rotate controls
    const handleRotate = (direction: 'left' | 'right') => {
        if (!userImageRef.current) return;
        const angle = direction === 'left' ? -90 : 90;
        const newRotation = rotation + angle;
        setRotation(newRotation);
        userImageRef.current.rotate(newRotation);
        fabricCanvasRef.current?.renderAll();
    };

    // Reset
    const handleReset = () => {
        if (!userImageRef.current) return;
        setZoom(100);
        setRotation(0);

        const el = userImageRef.current._element;
        if (el) {
            const scale = Math.max(500 / el.width, 500 / el.height);
            userImageRef.current.set({
                scaleX: scale,
                scaleY: scale,
                left: (500 - el.width * scale) / 2,
                top: (500 - el.height * scale) / 2,
                angle: 0,
            });
            fabricCanvasRef.current?.renderAll();
        }
        showToast('info', 'Foto telah direset.');
    };

    // Download PNG
    const handleDownload = async () => {
        if (!fabricCanvasRef.current) return;

        setDownloading(true);
        showToast('info', 'Menyiapkan gambar...');

        try {
            const fabricModule = await import('fabric');
            const fabric = (fabricModule as any).fabric || (fabricModule as any).default || fabricModule;

            // Create a temporary canvas at full template resolution
            const tplW = template.width;
            const tplH = template.height;
            const scaleFactor = tplW / 500;

            // Deselect any active object
            fabricCanvasRef.current.discardActiveObject();
            fabricCanvasRef.current.renderAll();

            // Get current user image transform
            const userImg = userImageRef.current;
            const userTransform = userImg
                ? {
                    src: userImg.getSrc ? userImg.getSrc() : userImg._element?.src,
                    scaleX: userImg.scaleX * scaleFactor,
                    scaleY: userImg.scaleY * scaleFactor,
                    left: userImg.left * scaleFactor,
                    top: userImg.top * scaleFactor,
                    angle: userImg.angle,
                }
                : null;

            // Create temp canvas at full resolution
            const tempCanvas = new fabric.StaticCanvas(null, {
                width: tplW,
                height: tplH,
                backgroundColor: 'transparent',
            });

            // Add user image first (bottom layer)
            if (userTransform && userTransform.src) {
                const imgEl = await loadImage(userTransform.src);
                const userObj = new fabric.Image(imgEl, {
                    selectable: false,
                    evented: false,
                    left: userTransform.left,
                    top: userTransform.top,
                    scaleX: userTransform.scaleX,
                    scaleY: userTransform.scaleY,
                    angle: userTransform.angle,
                    originX: 'left',
                    originY: 'top',
                });
                tempCanvas.add(userObj);
            }

            // Add template overlay (top layer)
            const tplEl = await loadImage(template.image);
            const tplObj = new fabric.Image(tplEl, {
                selectable: false,
                evented: false,
                left: 0,
                top: 0,
                scaleX: tplW / tplEl.width,
                scaleY: tplH / tplEl.height,
            });
            tempCanvas.add(tplObj);

            // Render and export
            tempCanvas.renderAll();

            const dataURL = tempCanvas.toDataURL({
                format: 'png',
                quality: 1.0,
                multiplier: 1,
            });

            // Trigger download
            const link = document.createElement('a');
            link.download = `twibbon-${template.slug}.png`;
            link.href = dataURL;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            tempCanvas.dispose();

            showToast('success', 'Twibbon berhasil diunduh!');
        } catch (err) {
            console.error('Download error:', err);
            showToast('error', 'Gagal mengunduh twibbon. Coba lagi.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="pattern-bg min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border bg-white/80 backdrop-blur-md">
                <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 md:px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-sm font-black text-white">T</div>
                        <span className="text-sm font-extrabold text-ink">Twibbon Editor</span>
                    </div>
                    <a href="/" className="text-xs font-semibold text-muted transition hover:text-ink">← Beranda</a>
                </div>
            </header>

            {/* Debug overlay (dev only, toggle with ?debug=1) */}
            {debugMode && (
                <div className="fixed right-4 top-20 z-50 rounded-lg border border-border bg-white p-3 text-xs text-ink shadow-lg">
                    <div className="font-semibold">Debug</div>
                    <div>loading: {String(loading)}</div>
                    <div>hasImage: {String(hasImage)}</div>
                    <div>canvasRef: {String(Boolean(canvasRef.current))}</div>
                    <div className="truncate">template: {template.image}</div>
                    <div className="mt-2 font-semibold">Events:</div>
                    <div style={{ maxHeight: 200, overflow: 'auto', width: 320 }}>
                        {debugEvents.slice(-20).map((d, i) => (
                            <div key={i} className="text-xs text-muted">{d}</div>
                        ))}
                    </div>
                </div>
            )}

            <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-6">
                <div className="flex gap-8">
                    {/* Left controls (kept compact) */}
                    <aside className="w-80 shrink-0">
                        <div className="rounded-3xl border border-border bg-white p-6 shadow-[0_8px_30px_rgba(37,99,235,0.06)]">
                            <section className="mb-6">
                                <div className="mb-3 flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">1</span>
                                    <h3 className="text-sm font-bold text-ink">Pilih Template</h3>
                                </div>
                                <div className="flex items-center gap-3 rounded-2xl border-2 p-3">
                                    <div className="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-xl bg-bg">
                                        <img src={template.thumbnail} alt={template.name} className="h-full w-full object-contain" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-ink">{template.name}</p>
                                        <p className="mt-0.5 text-xs text-muted">{template.width} × {template.height} px</p>
                                    </div>
                                </div>
                            </section>

                            <section className="mb-6">
                                <div className="mb-3 flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">2</span>
                                    <h3 className="text-sm font-bold text-ink">Upload Foto</h3>
                                </div>
                                <label onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition ${isDragging ? 'border-primary bg-blue-50' : 'border-blue-200 bg-blue-50/40 hover:border-primary hover:bg-blue-50'}`}>
                                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">⤴</div>
                                    <span className="text-sm font-bold text-ink">Klik untuk memilih foto</span>
                                    <span className="mt-1.5 text-xs text-muted">atau seret foto ke sini</span>
                                    <input ref={fileInputRef} type="file" className="hidden" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleInputChange} />
                                </label>
                            </section>

                            <section>
                                <div className="mb-3 flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">3</span>
                                    <h3 className="text-sm font-bold text-ink">Atur Foto</h3>
                                </div>

                                <div className="mb-4">
                                    <div className="mb-2 flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-muted">Zoom</span>
                                        <span className="text-xs font-bold text-primary">{zoom}%</span>
                                    </div>
                                    <input type="range" min={50} max={200} value={zoom} onChange={(e) => handleZoom(parseInt(e.target.value))} disabled={!hasImage} className="w-full disabled:opacity-40" />
                                </div>

                                <div className="mb-3 flex gap-3">
                                    <button onClick={() => handleRotate('left')} disabled={!hasImage} className="flex-1 rounded-xl border border-border px-3 py-2 text-sm">↺ Putar Kiri</button>
                                    <button onClick={() => handleRotate('right')} disabled={!hasImage} className="flex-1 rounded-xl border border-border px-3 py-2 text-sm">↻ Putar Kanan</button>
                                </div>
                                <button onClick={handleReset} disabled={!hasImage} className="w-full rounded-xl border border-border px-3 py-2 text-sm">Reset</button>
                                <p className="mt-4 text-xs text-muted">💡 Geser foto langsung pada area preview untuk menyesuaikan posisi wajah.</p>
                            </section>
                        </div>
                    </aside>

                    {/* Right preview */}
                    <section className="flex-1">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">LIVE PREVIEW</div>
                                <h2 className="text-lg font-bold">{template.name}</h2>
                            </div>
                            <button onClick={handleDownload} disabled={downloading} className="rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2 text-sm font-bold text-white shadow-lg">{downloading ? 'Mengunduh...' : 'Download PNG'}</button>
                        </div>

                        <div className="mt-6 flex justify-center">
                            <div className="w-full max-w-[720px] rounded-3xl border border-border bg-white p-6 shadow-sm">
                                <div data-twibbon-canvas className="relative aspect-square w-full overflow-hidden rounded-2xl bg-checkerboard flex items-center justify-center">
                                    <canvas ref={canvasRef} width={500} height={500} className="mx-auto block max-w-full max-h-full" />
                                    {loading && (
                                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                                            <div className="flex h-16 w-16 items-center justify-center">
                                                <div className="h-16 w-16 animate-spin rounded-full border-4 border-t-primary" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="absolute right-4 top-4 flex flex-col items-end gap-3">
                                        <div className="rounded-xl bg-white/80 px-3 py-2 text-sm font-medium">Hasil download mengikuti resolusi template asli. Template ini berukuran {template.width} × {template.height} px.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            {/* Mobile sticky bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white/90 p-3 backdrop-blur-md lg:hidden">
                <button onClick={handleDownload} disabled={!hasImage || downloading} className="w-full rounded-full bg-gradient-to-r from-primary to-secondary py-3 text-sm font-bold text-white shadow-lg disabled:opacity-50">{downloading ? 'Menyiapkan...' : 'Download PNG'}</button>
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl lg:bottom-6 ${toast.type === 'success' ? 'bg-green-600 text-white' : toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-ink text-white'}`}>
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
