import { NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import sanitizeHtml from 'sanitize-html';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (!article || !article.content || article.content.trim().length < 50) {
      return NextResponse.json({
        title: article?.title || doc.window.document.title || 'Título Desconhecido',
        content: `
          <blockquote>
            <p><strong>⚠️ Não foi possível extrair o texto desta página.</strong></p>
            <p>Isso geralmente acontece porque:</p>
            <ul>
              <li>A página exige JavaScript para carregar o texto (ex: Twitter, Instagram, sites modernos).</li>
              <li>O site possui proteção contra robôs e leitores automáticos.</li>
              <li>O conteúdo está bloqueado por paywall (assinatura).</li>
            </ul>
            <p>Por favor, clique no link original para ler diretamente no site.</p>
          </blockquote>
        `
      });
    }

    // Sanitize the HTML
    const cleanContent = sanitizeHtml(article.content, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img', 'h1', 'h2', 'h3' ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ['src', 'alt', 'title', 'width', 'height']
      }
    });

    return NextResponse.json({
      title: article.title,
      content: cleanContent
    });
  } catch (error: any) {
    console.error('Reader API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to parse article' }, { status: 500 });
  }
}
