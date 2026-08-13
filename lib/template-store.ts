import fs from 'fs';
import path from 'path';

export interface Template {
    id: string;
    slug: string;
    name: string;
    description: string;
    thumbnail: string;
    image: string;
    category: string;
    width: number;
    height: number;
    active: boolean;
    createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');

function ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(TEMPLATES_FILE)) {
        fs.writeFileSync(TEMPLATES_FILE, JSON.stringify([], null, 2));
    }
}

export function getTemplates(): Template[] {
    ensureDataFile();
    const raw = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
    return JSON.parse(raw);
}

export function getTemplateBySlug(slug: string): Template | null {
    const templates = getTemplates();
    return templates.find((t) => t.slug === slug) || null;
}

export function saveTemplate(template: Template): void {
    ensureDataFile();
    const templates = getTemplates();
    templates.push(template);
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
}

export function deleteTemplate(id: string): void {
    ensureDataFile();
    const templates = getTemplates().filter((t) => t.id !== id);
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
}

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

export function generateId(): string {
    return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
