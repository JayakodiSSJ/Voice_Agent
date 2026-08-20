// lib/rag/retriever.ts
//  domain aware search, richer context formatting for Gemini

import { Pinecone } from '@pinecone-database/pinecone';

let pinecone: Pinecone | null = null;
function getPinecone() {
  if (!pinecone) {
    pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY || 'dummy-key-for-build' });
  }
  return pinecone;
}
const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'slt-knowledge';

async function embedQuery(text: string): Promise<number[]> {


  const res = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.JINA_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'jina-embeddings-v5-text-small',
      input: [text.substring(0, 8000)],
    }),
  });
  const data = await res.json() as { data?: { embedding: number[] }[] };
  if (!data.data?.[0]?.embedding) throw new Error(`Jina embed failed: ${JSON.stringify(data)}`);
  return data.data[0].embedding;
}

export interface RetrievedChunk {
  text: string;
  source: string;
  domain: string;
  score: number;
}

export async function retrieveRelevantChunks(
  tenantSlug: string,
  userQuery: string,
  topK = 4,
  scoreThreshold = 0.4,   // lowered from 0.5 — catches more relevant content
): Promise<RetrievedChunk[]> {
  try {
    const queryVector = await embedQuery(userQuery);
    const results = await getPinecone()
      .index(INDEX_NAME)
      .namespace(`${tenantSlug}-content`)
      .query({ vector: queryVector, topK, includeMetadata: true });

    const chunks = results.matches
      .filter(m => (m.score ?? 0) >= scoreThreshold)
      .map(m => ({
        text: (m.metadata?.text as string) || '',
        source: (m.metadata?.source as string) || '',
        domain: (m.metadata?.domain as string) || 'general',
        score: m.score ?? 0,
      }))
      .filter(c => c.text.length > 0);

    console.log(` RAG: ${chunks.length} chunks for "${userQuery.slice(0, 50)}" — scores: ${chunks.map(c => c.score.toFixed(2)).join(', ')}`);
    return chunks;
  } catch (err) {
    console.warn(' RAG retrieval failed, LLM-only mode:', err);
    return [];
  }
}

export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '';
  const body = chunks
    .map((c, i) => `[${i + 1}] (${c.domain}) ${c.source}\n${c.text}`)
    .join('\n\n---\n\n');
  return `RELEVANT SLT MOBITEL INFORMATION:\n\n${body}`;
}