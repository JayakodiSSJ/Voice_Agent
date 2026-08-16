import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

let ai: GoogleGenAI | null = null;
function getAI() {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy-key-for-build' });
  }
  return ai;
}

// IMPORTANT: this MUST be the dedicated TTS model — NOT gemini-3-flash-preview
// gemini-3-flash-preview does NOT support audio output — it only does text
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

const VOICE_MAP: Record<string, string> = {
  si: 'Charon',
  ta: 'Kore',
};

export async function POST(request: NextRequest) {
  try {
    const { text, lang } = await request.json() as { text: string; lang: string };

    if (!text || !lang) return NextResponse.json({ error: 'missing text or lang' }, { status: 400 });
    if (lang === 'en') return NextResponse.json({ error: 'use browser TTS for English' }, { status: 400 });

    const voice = VOICE_MAP[lang] || 'Charon';
    console.log(`tts: model=${TTS_MODEL} voice=${voice} lang=${lang} chars=${text.length}`);

    const response = await getAI().models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    const audioPart = parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('audio/'));

    if (!audioPart?.inlineData?.data) {
      console.error('tts: no audio part in response. parts:', JSON.stringify(parts?.map((p: any) => ({ type: p.text ? 'text' : 'audio', mime: p.inlineData?.mimeType }))));
      return NextResponse.json({ error: 'no audio generated' }, { status: 500 });
    }

    const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
    const mimeType = audioPart.inlineData.mimeType || 'audio/wav';
    console.log(`tts success: ${audioBuffer.length} bytes [${mimeType}]`);

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('tts error:', msg);

    // tell frontend if it's a rate limit so it can show a message
    const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
    return NextResponse.json({
      error: isRateLimit ? 'rate_limit' : 'tts failed',
      detail: msg,
    }, { status: 500 });
  }
}