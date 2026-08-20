// app/api/rag/reindex/route.ts
// PURPOSE: This API route triggers a fresh reindex of a tenant's knowledge base.
// Call this manually whenever you want to refresh data:
//   GET http://localhost:3000/api/rag/reindex?secret=your_secret
// For automatic updates, set up a cron job (e.g. using Vercel Cron or
// an external service like cron-job.org) to call this URL daily or weekly.
//
// SECURITY: The secret key prevents random people from triggering a reindex.
// Set REINDEX_SECRET in your .env.local to any random string.
import { NextRequest, NextResponse } from 'next/server';
import { runIndexing } from '../../../lib/rag/indexer';
import { getTenant } from '../../../lib/tenant/resolve';

export async function GET(request: NextRequest) {
  // verify the secret key so only you can trigger a reindex
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== process.env.REINDEX_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const tenant = await getTenant(request);
  if (!tenant) {
    return NextResponse.json({ error: 'unknown tenant' }, { status: 404 });
  }

  try {
    const start = Date.now();
    // runIndexing: scrapes → deletes old Pinecone data for this tenant → stores new data
    const result = await runIndexing(tenant.id, tenant.slug);
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    return NextResponse.json({
      success: true,
      message: `${tenant.slug} knowledge base updated successfully`,
      chunksIndexed: result.chunksIndexed,
      pagesScraped: result.pagesScraped,
      durationSeconds: duration,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('reindex failed:', error);
    return NextResponse.json({ error: 'reindex failed', detail: String(error) }, { status: 500 });
  }
}