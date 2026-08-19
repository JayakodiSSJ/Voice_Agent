// app/api/voice/route.ts
// ─────────────────────────────────────────────────────────────────
// PURPOSE: Main voice agent API — now upgraded with RAG.
// Every user query goes through this pipeline:
//
//   1. STT  — convert voice to text (Whisper for EN, Google for SI/TA)
//   2. RAG  — search Pinecone for relevant SLT knowledge chunks
//   3. LLM  — answer using retrieved context + conversation memory
//   4. TTS  — convert answer to audio (browser for EN, Google for SI/TA)
//
// The key upgrade from v1: Step 2 (RAG) is new.
// Before v2, LLM answered from training data only — could be outdated.
// Now it answers from real SLT data we indexed from their official website.
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import Groq, { toFile } from 'groq-sdk';
import { saveTurn, getHistory } from "@/db/turns";

import { getTenant } from "@/app/lib/tenant/resolve";
import { extractText, getDocumentProxy } from 'unpdf';
import { retrieveRelevantChunks, formatChunksForPrompt } from '../../lib/rag/retriever';

let groq: Groq | null = null;
function getGroq() {
  if (!groq) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy-key-for-build' });
  }
  return groq;
}
const GKEY = process.env.GOOGLE_CLOUD_API_KEY!;

// language config — STT language code, TTS voice name, LLM instruction
const LANG_CONFIG: Record<string, { instruction: string; bcp47: string; googleVoice: string }> = {
  en: {
    instruction: 'Always reply in English. Under 120 words. No markdown.',
    bcp47: 'en-US',
    googleVoice: '', // empty = use browser TTS for English
  },
  si: {
    instruction: 'CRITICAL: Reply ONLY in Sinhala (සිංහල). Never write English words. Natural conversational Sinhala.',
    bcp47: 'si-LK',
    googleVoice: 'si-LK-Standard-A',
  },
  ta: {
    instruction: 'CRITICAL: Reply ONLY in Tamil (தமிழ்). Never write English words. Natural conversational Tamil.',
    bcp47: 'ta-LK',
    googleVoice: 'ta-IN-Standard-A',
  },
};

// ── Google Speech-to-Text ─────────────────────────────────────────
// Converts Sinhala/Tamil audio to text using Google's speech servers.
// Much more accurate than Whisper for these low-resource languages.
async function googleSTT(audioBuffer: Buffer, langCode: string): Promise<string> {
  const res = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${GKEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: LANG_CONFIG[langCode].bcp47,
      },
      audio: { content: audioBuffer.toString('base64') },
    }),
  });
  const data = await res.json();
  return data.results?.[0]?.alternatives?.[0]?.transcript || '';
}

// ── Google Text-to-Speech ─────────────────────────────────────────
// Converts Sinhala/Tamil answer text into MP3 audio.
// Returns base64-encoded MP3 — frontend plays it with new Audio().
// This works on ALL devices, no Windows voice pack needed.
async function googleTTS(text: string, langCode: string): Promise<string> {
  const cfg = LANG_CONFIG[langCode];
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GKEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: cfg.bcp47, name: cfg.googleVoice },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: langCode === 'en' ? 1.0 : 0.9, // slightly slower for SI/TA clarity
      },
    }),
  });
  const data = await res.json();
  return data.audioContent || ''; // base64 MP3
}

// ── Live web scraper (fallback for non-SLT queries) ───────────────
// Used when user asks to visit a specific URL not in our knowledge base.
// e.g. "go to bbc.com and tell me the headlines"
async function scrapeWebsite(url: string): Promise<string> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    return (await page.evaluate(() => document.body.innerText)).substring(0, 4000);
  } catch (err) {
    throw new Error(`scrape failed: ${err}`);
  } finally {
    if (browser) await browser.close();
  }
}

// ── PDF text extractor ────────────────────────────────────────────
// unpdf extracts plain text from PDFs — works in Next.js App Router.
// (we use this instead of pdf-parse which has CommonJS import issues)
async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join(' ') : text)
    .replace(/\s+/g, ' ').trim().substring(0, 6000);
}

// ── Decide if query needs live web scraping ───────────────────────
// We ask Llama: does answering this need a live website visit?
// This saves time — most SLT questions are answered by RAG, not scraping.
async function needsLiveScraping(userText: string): Promise<{ needed: boolean; url: string | null }> {
  const res = await getGroq().chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{
      role: 'user',
      content: `Does answering this require visiting a SPECIFIC website URL right now?
User asked: "${userText}"
Reply ONLY valid JSON: {"needed": true or false, "url": "full url or null"}
Note: questions about SLT plans, prices, or services do NOT need live scraping (we have that data).`,
    }],
  });
  try {
    const parsed = JSON.parse((res.choices[0].message.content || '').replace(/```json|```/g, '').trim());
    return { needed: parsed.needed, url: parsed.url };
  } catch {
    return { needed: false, url: null };
  }
}

// ── MAIN API HANDLER ──────────────────────────────────────────────
export async function POST(request: NextRequest) {

  try {
    const tenant = await getTenant(request);
    if (!tenant) {
      return NextResponse.json({ error: "unknown tenant" }, { status: 404 });
    }
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const uploadedFile = formData.get('file') as File | null;
    const sessionId = (formData.get('sessionId') as string) || 'default';
    const langCode = (formData.get('language') as string) || 'en';
    const lang = LANG_CONFIG[langCode];

    if (!audioFile) return NextResponse.json({ error: 'no audio received' }, { status: 400 });

    // ── STEP 1: Speech to Text ──────────────────────────────────
    // English → Groq Whisper (faster, free)
    // Sinhala/Tamil → Google STT (much more accurate for these languages)
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    let userText = '';

    if (langCode === 'en') {
      const groqAudio = await toFile(audioBuffer, 'recording.webm', { type: 'audio/webm' });
      const t = await getGroq().audio.transcriptions.create({
        file: groqAudio,
        model: 'whisper-large-v3',
        language: 'en',
        response_format: 'json',
      });
      userText = t.text.trim();
    } else {
      // Google STT handles Sinhala (si-LK) and Tamil (ta-LK) natively
      userText = await googleSTT(audioBuffer, langCode);
    }


    if (!userText) return NextResponse.json({ error: 'could not understand audio' }, { status: 400 });

    // save user message to SQLite memory (conversation history)
    await saveTurn(tenant.id, sessionId, "user", userText);

    let answer = '';

    // ── STEP 2: Handle file upload (image or PDF) ───────────────
    // If user attached a file, analyse it directly — skip RAG for this case
    // because the user wants to ask about THEIR file, not SLT data
    if (uploadedFile && uploadedFile.size > 0) {
      const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());

      if (uploadedFile.type.startsWith('image/')) {
        // vision model analyses the image
        const r = await getGroq().chat.completions.create({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: `${lang.instruction}\nUser asked: "${userText}". Answer based on the image.` },
              { type: 'image_url', image_url: { url: `data:${uploadedFile.type};base64,${fileBuffer.toString('base64')}` } },
            ],
          }],
        });
        answer = r.choices[0].message.content || '';

      } else if (uploadedFile.type === 'application/pdf') {
        // extract PDF text, then ask LLM to answer based on it
        const pdfText = await extractPdfText(fileBuffer).catch(() => 'could not extract PDF text');
        const history = await getHistory(tenant.id, sessionId, 6);
        const r = await getGroq().chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: `${lang.instruction} Answer based on the document provided.` },
            ...history.map(t => ({ role: t.role as 'user' | 'assistant', content: t.content })),
            { role: 'user', content: `User asked: "${userText}"\n\nDocument content:\n${pdfText}` },
          ],
        });
        answer = r.choices[0].message.content || '';
      }

    } else {
      // ── STEP 3: RAG Retrieval ─────────────────────────────────
      // Search our Pinecone vector database for relevant SLT information.
      // This runs BEFORE calling the LLM — we get the facts first.
      // retrieveRelevantChunks: userText → embedding → Pinecone search → top 3 chunks
      const ragChunks = await retrieveRelevantChunks(userText, 3, 0.5);

      // format chunks into a readable context block for the LLM prompt
      // e.g. "[Source 1: slt.lk/broadband]\nFibre 100Mbps — Rs.2999/month..."
      const ragContext = formatChunksForPrompt(ragChunks);

      // ── STEP 4: Check if live scraping is also needed ─────────
      // RAG handles most SLT questions. But if user asks to visit
      // a specific URL (e.g. "check bbc.com"), we scrape it live.
      let webData = '';
      const scrapeDecision = await needsLiveScraping(userText);
      if (scrapeDecision.needed && scrapeDecision.url) {

        try { webData = await scrapeWebsite(scrapeDecision.url); }
        catch { webData = 'website could not be loaded'; }
      }

      // ── STEP 5: LLM with RAG context + memory ────────────────
      //
      //   - language instruction (reply in Sinhala/Tamil/English)
      //   - RAG context (real SLT data retrieved from Pinecone)
      // The messages array contains:
      //   - conversation history (from SQLite memory — remembers past turns)
      //   - current user message + optional live web data
      const history = await getHistory(tenant.id, sessionId, 8);

      const systemPrompt = `You are SLT Mobitel Voice AI — a helpful assistant with memory and real-time SLT knowledge.
${lang.instruction}
${ragContext}
Rules: No markdown, no asterisks, no bullet points — speak naturally as this will be read aloud.
If the answer is in the SLT information above, use it. If not, use your general knowledge.`;

      const r = await getGroq().chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          // inject conversation history so agent remembers previous turns
          ...history.map(t => ({ role: t.role as 'user' | 'assistant', content: t.content })),
          {
            role: 'user',
            // combine user question + optional live web data
            content: webData ? `${userText}\n\n[live web content: ${webData}]` : userText,
          },
        ],
      });
      answer = r.choices[0].message.content || "sorry, I couldn't generate a response";
    }

    // clean up any markdown symbols before TTS reads it aloud
    answer = answer.replace(/[*_`#]/g, '').trim();

    // save assistant answer to SQLite memory for future context
    await saveTurn(tenant.id, sessionId, 'assistant', answer);


    // ── STEP 6: Text to Speech ────────────────────────────────
    // English → return text only, frontend uses browser TTS (fast, free)
    // Sinhala/Tamil → Google TTS returns MP3 as base64 (works on all devices)
    let audioBase64 = '';
    if (langCode !== 'en') {
      audioBase64 = await googleTTS(answer, langCode);
    }

    return NextResponse.json({ transcription: userText, answer, audioBase64, sessionId });

  } catch (error) {
    console.error('voice agent error:', error);
    return NextResponse.json({ error: 'agent failed' }, { status: 500 });
  }
}