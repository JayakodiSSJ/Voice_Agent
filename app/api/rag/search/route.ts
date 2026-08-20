// app/api/rag/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { retrieveRelevantChunks } from '../../../lib/rag/retriever';
import { getTenant } from '../../../lib/tenant/resolve';

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req);
  if (!tenant) {
    return NextResponse.json({ error: 'unknown tenant' }, { status: 404 });
  }

  const query = req.nextUrl.searchParams.get('query')?.trim() ?? '';
  if (!query) return NextResponse.json({ result: '', chunkCount: 0 });
  try {
    const chunks = await retrieveRelevantChunks(tenant.slug, query, 2, 0.4);
    if (chunks.length === 0) {
      return NextResponse.json({
        result: 'No specific information found in the knowledge base for this query.',
        chunkCount: 0,
      });
    }
    const lines = chunks.map((c, i) => {
      const shortText = c.text.length > 350 ? c.text.slice(0, 347) + '...' : c.text;
      return `[${i + 1}] ${shortText}`;
    });
    const result = lines.join('\n\n');
    return NextResponse.json({ result, chunkCount: chunks.length });
  } catch (err) {
    console.error('RAG search error:', err);
    return NextResponse.json({
      result: 'Knowledge base search failed. Answer from general knowledge.',
      chunkCount: 0,
    }, { status: 200 });
  }
}