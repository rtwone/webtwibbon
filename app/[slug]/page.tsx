import { notFound } from 'next/navigation';
import { getTemplateBySlug } from '@/lib/template-store';
import TwibbonEditor from './editor';

export async function generateStaticParams() {
    return [];
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
    const template = await getTemplateBySlug(params.slug);
    return {
        title: template ? `${template.name} — Twibbon` : 'Twibbon Editor',
        description: template?.description || 'Buat twibbon Anda sendiri.',
    };
}

export default async function SlugPage({ params }: { params: { slug: string } }) {
    const template = await getTemplateBySlug(params.slug);

    if (!template) {
        notFound();
    }

    return <TwibbonEditor template={template} />;
}
