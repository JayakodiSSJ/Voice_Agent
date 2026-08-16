// app/api/rag/search/route.ts
// ─────────────────────────────────────────────────────────────────
// FIX: Return shorter, cleaner text so Gemini doesn't loop.
//   - 2 chunks max (was 4) — less context = faster answer
//   - 350 chars per chunk (was 600) — concise, Gemini-friendly
//   - Plain text format, no headers — easier for Gemini to use
// ─────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { retrieveRelevantChunks } from '../../../lib/rag/retriever';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query')?.trim() ?? '';
  if (!query) return NextResponse.json({ result: '', chunkCount: 0 });

  try {
    // Only 2 chunks — enough context, not overwhelming
    const chunks = await retrieveRelevantChunks(query, 2, 0.4);

    if (chunks.length === 0) {
      return NextResponse.json({
        result: 'No specific information found in the SLT Mobitel knowledge base for this query.',
        chunkCount: 0,
      });
    }

    // Build concise plain-text response — no formatting headers
    // Truncate each chunk to 350 chars to keep total under 800 chars
    const lines = chunks.map((c, i) => {
      const shortText = c.text.length > 350 ? c.text.slice(0, 347) + '...' : c.text;
      return `[${i + 1}] ${shortText}`;
    });

    const result = lines.join('\n\n');

    return NextResponse.json({ result, chunkCount: chunks.length });

  } catch (err) {
    console.error('RAG search error:', err);
    return NextResponse.json({
      result: 'Knowledge base search failed. Answer from general SLT Mobitel knowledge.',
      chunkCount: 0,
    }, { status: 200 }); // always 200 so Gemini gets a tool response
  }
}