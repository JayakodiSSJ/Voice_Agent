// lib/rag/indexer.ts

// Covers all 5 mandatory domains:
//   1. Telco Customer Support  (data balance, fault reporting)
//   2. Package Recommendation  (prepaid/postpaid/fibre/4G/5G plans)
//   3. Bill Payment Assistant  (billing, payment methods, eBill)
//   4. Training & Knowledge    (company profile, policies, SOPs)
//   5. New Connection          (fibre/4G new connection requests)
 

import puppeteer from 'puppeteer';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Pinecone } from '@pinecone-database/pinecone';

let pinecone: Pinecone | null = null;
function getPinecone() {
  if (!pinecone) {
    pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY || 'dummy-key-for-build' });
  }
  return pinecone;
}
const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'slt-knowledge';

// 
// SEED URLs — grouped by competition domain
// The crawler discovers child pages automatically from each seed.
// Add more seeds here if you find new SLT sub-domains.
 
const SEED_URLS: { url: string; domain: string }[] = [

  //  Telco Customer Support 
  // Data balance, connection issues, fault reporting, USSD codes
  { url: 'https://www.sltmobitel.lk/support',                                                                         domain: 'support' },
  { url: 'https://www.sltmobitel.lk/support?type=mobile&firstTab=prepaid',                                            domain: 'support' },
  { url: 'https://www.sltmobitel.lk/support?type=mobile&firstTab=postpaid',                                           domain: 'support' },
  { url: 'https://www.sltmobitel.lk/support?type=mobile&firstTab=billing&secondTab=bill-inquiries',                   domain: 'support' },
  { url: 'https://www.sltmobitel.lk/support?type=mobile&firstTab=data',                                               domain: 'support' },
  { url: 'https://www.sltmobitel.lk/support?type=fixed&firstTab=internet',                                            domain: 'support' },
  { url: 'https://www.sltmobitel.lk/support?type=fixed&firstTab=billing',                                             domain: 'support' },
  { url: 'https://www.sltmobitel.lk/support?type=fixed&firstTab=telephone',                                           domain: 'support' },
  { url: 'https://www.sltmobitel.lk/contact-us',                                                                      domain: 'support' },
  { url: 'https://www.sltmobitel.lk/contact-us/feedback',                                                             domain: 'support' },
  // Legacy Mobitel support (rich FAQ content)
  { url: 'https://www.mobitel.lk/quick-fix-support',                                                                  domain: 'support' },
  { url: 'https://www.mobitel.lk/support',                                                                            domain: 'support' },
  { url: 'https://www.mobitel.lk/service-difficulties',                                                               domain: 'support' },
  // Legacy SLT support portal
  { url: 'https://www.slt.lk/en/support',                                                                             domain: 'support' },

  // Package Recommendation 
  // Mobile prepaid data plans
  { url: 'https://www.sltmobitel.lk/personal?type=mobile&firstTab=broadband&secondTab=prepaid-data&thirdTab=anytime-plans',    domain: 'packages' },
  { url: 'https://www.sltmobitel.lk/personal?type=mobile&firstTab=broadband&secondTab=prepaid-data&thirdTab=night-plans',      domain: 'packages' },
  { url: 'https://www.sltmobitel.lk/personal?type=mobile&firstTab=broadband&secondTab=prepaid-data&thirdTab=weekly-plans',     domain: 'packages' },
  // Mobile postpaid data plans
  { url: 'https://www.sltmobitel.lk/personal?type=mobile&firstTab=broadband&secondTab=postpaid-data&thirdTab=anytime-plans',   domain: 'packages' },
  { url: 'https://www.sltmobitel.lk/personal?type=mobile&firstTab=broadband&secondTab=postpaid-data&thirdTab=content-based-plans', domain: 'packages' },
  // Mobile voice plans
  { url: 'https://www.sltmobitel.lk/personal?type=mobile&firstTab=voice',                                             domain: 'packages' },
  { url: 'https://www.sltmobitel.lk/personal?type=mobile&firstTab=voice&secondTab=prepaid-voice',                     domain: 'packages' },
  { url: 'https://www.sltmobitel.lk/personal?type=mobile&firstTab=voice&secondTab=postpaid-voice',                    domain: 'packages' },
  // IDD & Roaming
  { url: 'https://www.sltmobitel.lk/personal?type=mobile&firstTab=idd-roaming',                                       domain: 'packages' },
  // Fixed fibre broadband plans
  { url: 'https://www.sltmobitel.lk/personal?type=fixed&firstTab=internet&secondTab=broadband&thirdTab=fibre-plans',  domain: 'packages' },
  { url: 'https://www.sltmobitel.lk/personal?type=fixed&firstTab=internet&secondTab=broadband&thirdTab=adsl-plans',   domain: 'packages' },
  // PEO TV
  { url: 'https://www.sltmobitel.lk/personal?type=fixed&firstTab=peotv',                                              domain: 'packages' },
  // Top-level personal page (has package overview)
  { url: 'https://www.sltmobitel.lk/personal',                                                                        domain: 'packages' },
  // Business packages
  { url: 'https://www.sltmobitel.lk/business',                                                                        domain: 'packages' },
  { url: 'https://www.sltmobitel.lk/business?type=enterprise',                                                        domain: 'packages' },
  { url: 'https://www.sltmobitel.lk/business?type=sme',                                                               domain: 'packages' },
  // 5G plans
  { url: 'https://5g.sltmobitel.lk/5gmobitel/',                                                                       domain: 'packages' },
  // Devices (helps with package+device recommendations)
  { url: 'https://www.sltmobitel.lk/devices',                                                                         domain: 'packages' },

  // Bill Payment Assistant 
  // Billing inquiry and payment methods
  { url: 'https://www.sltmobitel.lk/support?type=mobile&firstTab=billing',                                            domain: 'billing' },
  { url: 'https://www.sltmobitel.lk/support?type=fixed&firstTab=billing&secondTab=bill-inquiries',                    domain: 'billing' },
  { url: 'https://www.sltmobitel.lk/support?type=fixed&firstTab=billing&secondTab=payment-methods',                   domain: 'billing' },
  { url: 'https://www.sltmobitel.lk/support?type=fixed&firstTab=billing&secondTab=ebill',                             domain: 'billing' },
  // mCash digital payments
  { url: 'https://www.sltmobitel.lk/personal?type=mobile&firstTab=mcash',                                             domain: 'billing' },
  // Mobitel bill FAQ (very detailed)
  { url: 'https://www.mobitel.lk/quick-fix-support#billing',                                                          domain: 'billing' },

  // Training & Knowledge Assistant
  // Company profile, SOPs, policies, internal knowledge
  { url: 'https://www.sltmobitel.lk/about-us',                                                                        domain: 'knowledge' },
  { url: 'https://www.sltmobitel.lk/about-us?firstTab=SriLanka-Telecom-PLC&secondTab=company-profile',                domain: 'knowledge' },
  { url: 'https://www.sltmobitel.lk/about-us?firstTab=SriLanka-Telecom-PLC&secondTab=vision-mission',                 domain: 'knowledge' },
  { url: 'https://www.sltmobitel.lk/about-us?firstTab=SriLanka-Telecom-PLC&secondTab=milestones',                     domain: 'knowledge' },
  // Legal & policy docs
  { url: 'https://www.sltmobitel.lk/privacy-policy',                                                                  domain: 'knowledge' },
  { url: 'https://www.sltmobitel.lk/terms-of-use',                                                                    domain: 'knowledge' },
  { url: 'https://www.sltmobitel.lk/general-terms-conditions',                                                        domain: 'knowledge' },
  // Coverage map info
  { url: 'https://www.sltmobitel.lk/coverage-map',                                                                    domain: 'knowledge' },
  // Digital services
  { url: 'https://www.sltmobitel.lk/personal?type=mobile&firstTab=digital-services',                                  domain: 'knowledge' },
  { url: 'https://www.sltmobitel.lk/entertainment',                                                                   domain: 'knowledge' },

  //  New Connection Assistant 
  // Fibre new connection application
  { url: 'https://www.sltmobitel.lk/personal?type=fixed&firstTab=internet&secondTab=broadband&thirdTab=new-connection&forthTab=fibre', domain: 'new-connection' },
  { url: 'https://www.sltmobitel.lk/personal?type=fixed&firstTab=internet&secondTab=broadband&thirdTab=new-connection&forthTab=adsl',  domain: 'new-connection' },
  // Mobile postpaid new connection
  { url: 'https://www.sltmobitel.lk/personal?type=mobile&firstTab=broadband&secondTab=postpaid-data&thirdTab=new-connection',         domain: 'new-connection' },
  // Fixed telephone new connection
  { url: 'https://www.sltmobitel.lk/personal?type=fixed&firstTab=telephone&secondTab=new-connection',                domain: 'new-connection' },
  // PEO TV new connection
  { url: 'https://www.sltmobitel.lk/personal?type=fixed&firstTab=peotv&secondTab=new-connection',                    domain: 'new-connection' },
  // Business new connections
  { url: 'https://www.sltmobitel.lk/business?type=sme&firstTab=new-connection',                                      domain: 'new-connection' },
];

// Domains allowed for crawler link-following
// (keeps crawler within SLT properties)
const ALLOWED_DOMAINS = [
  'sltmobitel.lk',
  'www.sltmobitel.lk',
  'www.mobitel.lk',
  'www.slt.lk',
  '5g.sltmobitel.lk',
];

const MAX_PAGES = 120; // crawl up to 120 pages total


// Scrape a single page — returns text + discovered links
async function scrapePage(url: string): Promise<{ text: string; links: string[] }> {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2000));

    const { text, links } = await page.evaluate((allowedDomains: string[]) => {
      // Remove nav/footer noise
      document.querySelectorAll('nav,footer,script,style,header,iframe,noscript,[class*="cookie"],[id*="cookie"]')
        .forEach(el => el.remove());

      const rawText = (document.body.innerText || '').replace(/\s+/g, ' ').trim();

      // Collect internal links only
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => (a as HTMLAnchorElement).href)
        .filter(href => {
          try {
            const u = new URL(href);
            return (
              allowedDomains.some(d => u.hostname === d || u.hostname.endsWith('.' + d)) &&
              !href.includes('#') &&
              !href.includes('mailto:') &&
              !href.includes('tel:') &&
              !href.match(/\.(pdf|jpg|jpeg|png|gif|zip|mp4|mp3|webp|svg)$/i)
            );
          } catch { return false; }
        });

      return { text: rawText, links: [...new Set(links)] };
    }, ALLOWED_DOMAINS);

    return { text, links };
  } catch (err) {
    console.warn(`✗ failed ${url}:`, (err as Error).message);
    return { text: '', links: [] };
  } finally {
    await browser.close();
  }
}


// Embed text using Jina (same model as retriever.ts — must match)
async function embedText(text: string): Promise<number[]> {
  const res = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.JINA_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'jina-embeddings-v5-text-small', // 1024-dim, free, multilingual
      input: [text.substring(0, 8000)],
    }),
  });
  const data = await res.json() as { data?: { embedding: number[] }[] };
  if (!data.data?.[0]?.embedding) throw new Error(`Jina failed: ${JSON.stringify(data)}`);
  return data.data[0].embedding;
}


// Wipe old data, upsert fresh vectors
async function deleteOldData(): Promise<void> {
  try {
    await getPinecone().index(INDEX_NAME).namespace('slt-content').deleteAll();
    console.log('🗑️  cleared old Pinecone vectors');
  } catch {
    console.log('ℹ  namespace was empty — nothing to delete');
  }
}

interface Chunk { text: string; url: string; domain: string; id: string }

async function upsertChunks(chunks: Chunk[]): Promise<void> {
  const idx       = getPinecone().index(INDEX_NAME).namespace('slt-content');
  const timestamp = new Date().toISOString();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const values = await embedText(chunk.text);
      await idx.upsert({
        records: [{
          id: chunk.id,
          values,
          metadata: {
            text:      chunk.text,
            source:    chunk.url,
            domain:    chunk.domain,    // ← new: lets retriever filter by domain
            indexedAt: timestamp,
          },
        }],
      });
      console.log(` [${i + 1}/${chunks.length}] ${chunk.domain} — ${chunk.id.slice(0, 60)}`);
    } catch (e) {
      console.error(` embed failed for ${chunk.id}:`, (e as Error).message);
    }
    // 2 s gap — Jina free tier is generous but let's be polite
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 2000));
  }
}


// Main pipeline
 
export async function runIndexing(): Promise<{ chunksIndexed: number; pagesScraped: number }> {
  console.log(' SLT full-domain indexing started');
  console.log(` ${SEED_URLS.length} seed URLs across 5 domains`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize:    600,   // slightly larger for richer context per chunk
    chunkOverlap: 80,
  });

  const allChunks: Chunk[]  = [];
  const visited             = new Set<string>();
  // queue stores { url, domain } so domain label stays with discovered pages
  const queue: { url: string; domain: string }[] = [...SEED_URLS];

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const { url, domain } = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    console.log(`\n [${visited.size}/${MAX_PAGES}] [${domain}] ${url}`);
    const { text, links } = await scrapePage(url);

    if (!text || text.length < 80) {
      console.warn(`  skipping — too short (${text.length} chars)`);
      continue;
    }

    // Enqueue newly found internal links under the same domain label
    for (const link of links) {
      if (!visited.has(link) && !queue.some(q => q.url === link)) {
        queue.push({ url: link, domain });
      }
    }

    // Chunk and store with domain label
    const docs = await splitter.createDocuments([text]);
    docs.forEach((doc: { pageContent: string }, idx: number) => {
      const safeId = url.replace(/[^a-z0-9]/gi, '-').slice(0, 60);
      allChunks.push({
        text:   doc.pageContent,
        url,
        domain,
        id:     `${domain}-${safeId}-${idx}`,
      });
    });

    console.log(`✓ ${docs.length} chunks | ${links.length} new links | queue: ${queue.length}`);
    await new Promise(r => setTimeout(r, 1200)); // polite crawl delay
  }

  // Summary by domain before upserting
  const summary: Record<string, number> = {};
  allChunks.forEach(c => { summary[c.domain] = (summary[c.domain] ?? 0) + 1; });
  console.log('\n Chunks by domain:');
  Object.entries(summary).forEach(([d, n]) => console.log(`   ${d}: ${n} chunks`));
  console.log(`   TOTAL: ${allChunks.length} chunks from ${visited.size} pages\n`);

  await deleteOldData();
  await upsertChunks(allChunks);

  console.log(`\n Indexing complete — ${allChunks.length} vectors in Pinecone`);
  return { chunksIndexed: allChunks.length, pagesScraped: visited.size };
}