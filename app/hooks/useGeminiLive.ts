// app/hooks/useGeminiLive.ts

'use client';
import { useRef, useState, useCallback } from 'react';
import { AppLanguage } from '../components/voice/types';

//  gemini 3.1 preview

const MODEL  = 'models/gemini-3.1-flash-live-preview';
const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';

const TARGET_SR = 16000; // Gemini input: 16 kHz
const OUTPUT_SR = 24000; // Gemini output: 24 kHz
const WORKLET_ACCUMULATE = 4096; // samples to accumulate before sending

// Types 
export type LiveState =
  | 'disconnected' | 'connecting' | 'listening' | 'thinking' | 'speaking';

interface Options {
  language: AppLanguage;
  onTurnComplete: (heard: string, answer: string) => void;
  onError: (msg: string) => void;
}
interface Return {
  liveState:  LiveState;
  connect:    () => Promise<void>;
  disconnect: () => void;
  interrupt:  () => void;
  wsSend:     (payload: object) => void;
}

// PCM helpers 
function float32ToPCM16(f32: Float32Array): ArrayBuffer {
  const buf  = new ArrayBuffer(f32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buf;
}
function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let b = '';
  for (let i = 0; i < bytes.length; i++) b += String.fromCharCode(bytes[i]);
  return btoa(b);
}
function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf  = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}
// Linear-interpolation downsample — good enough for voice
function downsample(input: Float32Array, srcRate: number): Float32Array {
  if (srcRate === TARGET_SR) return input;
  const ratio  = srcRate / TARGET_SR;
  const outLen = Math.floor(input.length / ratio);
  const out    = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const lo = Math.floor(i * ratio);
    const hi = Math.min(lo + 1, input.length - 1);
    out[i]   = input[lo] * (1 - (i * ratio - lo)) + input[hi] * (i * ratio - lo);
  }
  return out;
}
function mergeF32(arrays: Float32Array[]): Float32Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out   = new Float32Array(total);
  let offset  = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

//  AudioWorklet code (runs in audio thread, no btoa needed here) ─
// We load this via a Blob URL so no extra public file is required
const WORKLET_CODE = `
class MicCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (ch?.length) this.port.postMessage(new Float32Array(ch));
    return true;
  }
}
registerProcessor('mic-capture', MicCapture);
`;

//  System prompt 
const SYSTEM_PROMPT = `You are Vidya, a warm and professional AI voice assistant for SLT Mobitel — Sri Lanka's leading telecommunications company.

Respond in the SAME language the user speaks: English, Sinhala (සිංහල), or Tamil (தமிழ்). Auto-detect from the first message.

You help with: data balance, mobile packages, fiber/4G connections, billing, plan recommendations, new connections.

When you need specific SLT product details, pricing, or policy info — call search_knowledge_base FIRST.
Keep responses concise (2–3 sentences). Be warm and professional.`;

const TOOLS = [{
  functionDeclarations: [{
    name: 'search_knowledge_base',
    description: 'Search SLT Mobitel knowledge base for product info, pricing, packages, and policies.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'Natural language search query' } },
      required: ['query'],
    },
  }],
}];


export function useGeminiLive({ language, onTurnComplete, onError }: Options): Return {

  const [liveState, setLiveState] = useState<LiveState>('disconnected');
  const stateRef = useRef<LiveState>('disconnected');

  const wsRef           = useRef<WebSocket | null>(null);
  const inputCtxRef     = useRef<AudioContext | null>(null);
  const workletRef      = useRef<AudioWorkletNode | null>(null);
  const micStreamRef    = useRef<MediaStream | null>(null);
  const outputCtxRef    = useRef<AudioContext | null>(null);
  const analyserRef     = useRef<AnalyserNode | null>(null);
  const nextPlayRef     = useRef(0);
  const sourcesRef      = useRef<AudioBufferSourceNode[]>([]);
  const heardRef        = useRef('');
  const answerRef       = useRef('');
  // Accumulate worklet chunks before sending (avoids flooding WS)
  const accBuf          = useRef<Float32Array[]>([]);
  const accLen          = useRef(0);

  const go = (s: LiveState) => { stateRef.current = s; setLiveState(s); };

  //  Play 24 kHz PCM chunk from Gemini 
  const playChunk = (b64: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;
    const raw = b64ToBuf(b64);
    const pcm = new Int16Array(raw);
    const f32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f32[i] = pcm[i] / 32768;

    const buf = ctx.createBuffer(1, f32.length, OUTPUT_SR);
    buf.getChannelData(0).set(f32);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (analyserRef.current) src.connect(analyserRef.current);
    else src.connect(ctx.destination);

    const t = Math.max(ctx.currentTime, nextPlayRef.current);
    src.start(t);
    nextPlayRef.current = t + buf.duration;

    sourcesRef.current.push(src);
    src.onended = () => { sourcesRef.current = sourcesRef.current.filter(s => s !== src); };
  };

  //  Interrupt 
  const interrupt = useCallback(() => {
    sourcesRef.current.forEach(s => { try { s.stop(0); } catch {} });
    sourcesRef.current = [];
    nextPlayRef.current = outputCtxRef.current?.currentTime ?? 0;
    if (stateRef.current === 'speaking') go('listening');
  }, []);

  //  RAG tool call 
 const handleToolCall = async (tc: {
  functionCalls: { id: string; name: string; args: Record<string, string> }[]
}) => {
  go('thinking');

  const responses = [];
  for (const call of tc.functionCalls ?? []) {
    if (call.name === 'search_knowledge_base') {
      try {
        const r = await fetch(`/api/rag/search?query=${encodeURIComponent(call.args.query ?? '')}`);
        const d = await r.json() as { result: string };
        responses.push({
          id: call.id,
          name: call.name,
          response: { output: d.result || 'No relevant information found.' }
        });
      } catch {
        responses.push({
          id: call.id,
          name: call.name,
          response: { output: 'Knowledge base temporarily unavailable.' }
        });
      }
    }
  }

  // Send toolResponse immediately — no delays, no clientContent injection
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(JSON.stringify({
      toolResponse: { functionResponses: responses }
    }));
  }
};

  // Send accumulated PCM to Gemini 
  // Use realtimeInput.audio 
  const sendAudioChunk = (f32: Float32Array) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    if (stateRef.current !== 'listening') return; // gate: don't send while Gemini speaks

    const resampled = downsample(f32, inputCtxRef.current?.sampleRate ?? TARGET_SR);
    const pcm16     = float32ToPCM16(resampled);
    const b64       = bufToB64(pcm16);

    //  NEW FORMAT — realtimeInput.audio (replaces deprecated mediaChunks)
    wsRef.current.send(JSON.stringify({
      realtimeInput: {
        audio: {
          data:     b64,
          mimeType: `audio/pcm;rate=${TARGET_SR}`,
        },
      },
    }));
  };

  //  Start AudioWorklet mic capture 
  const startMic = async (stream: MediaStream, ctx: AudioContext) => {
    // Load worklet via inline Blob URL (no public file needed)
    const blob    = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    try {
      await ctx.audioWorklet.addModule(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    const source   = ctx.createMediaStreamSource(stream);
    const worklet  = new AudioWorkletNode(ctx, 'mic-capture');
    workletRef.current = worklet;

    worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
      // Accumulate small worklet buffers (128 samples) into larger chunks
      accBuf.current.push(e.data);
      accLen.current += e.data.length;
      if (accLen.current >= WORKLET_ACCUMULATE) {
        const merged = mergeF32(accBuf.current);
        accBuf.current = [];
        accLen.current = 0;
        sendAudioChunk(merged);
      }
    };

    source.connect(worklet);
    worklet.connect(ctx.destination); // must connect output for worklet to run
  };

  // Connect 
  const connect = useCallback(async () => {
    disconnect();
    go('connecting');

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      onError('NEXT_PUBLIC_GEMINI_API_KEY not set in .env.local');
      go('disconnected');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      micStreamRef.current = stream;

      // Input AudioContext (mic capture)
      const inputCtx = new AudioContext();
      inputCtxRef.current = inputCtx;
      if (inputCtx.state === 'suspended') await inputCtx.resume();

      // Output AudioContext (Gemini audio playback)
      const outputCtx = new AudioContext();
      outputCtxRef.current = outputCtx;
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      // Analyser on output (for lip sync amplitude measurement)
      const analyser = outputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(outputCtx.destination);
      analyserRef.current = analyser;
      nextPlayRef.current = 0;

      // WebSocket
      const ws = new WebSocket(`${WS_URL}?key=${apiKey}`);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send setup — NO inputAudioTranscription / outputAudioTranscription
        // (those fields are not in v1alpha and cause 1007)
        ws.send(JSON.stringify({
          setup: {
            model: MODEL,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Sadaltager' },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: SYSTEM_PROMPT }],
            },
            tools: TOOLS,
          },
        }));
      };

      ws.onmessage = async (event) => {
        let msg: Record<string, unknown>;
        try {
          const text = event.data instanceof Blob ? await (event.data as Blob).text() : (event.data as string);
          msg = JSON.parse(text) as Record<string, unknown>;
        } catch { return; }

        // 1. Setup complete → start mic
        if (msg.setupComplete !== undefined) {
          go('listening');
          await startMic(stream, inputCtx);
          return;
        }

        // 2. Tool call → RAG → respond
        if (msg.toolCall) {
          await handleToolCall(msg.toolCall as Parameters<typeof handleToolCall>[0]);
          return;
        }

        // 3. Server audio + turn management
        if (msg.serverContent) {
          type SC = {
            modelTurn?: { parts?: { inlineData?: { mimeType: string; data: string } }[] };
            outputTranscription?: { text?: string };
            inputTranscription?:  { text?: string };
            turnComplete?: boolean;
            interrupted?: boolean;
          };
          const sc = msg.serverContent as SC;

          // Play audio chunks
          for (const part of sc.modelTurn?.parts ?? []) {
            if (part.inlineData?.mimeType?.startsWith('audio/pcm')) {
              if (stateRef.current !== 'speaking') go('speaking');
              playChunk(part.inlineData.data);
            }
          }

          // Collect transcript text (works if model supports it)
          if (sc.outputTranscription?.text) answerRef.current += sc.outputTranscription.text;
          if (sc.inputTranscription?.text)  heardRef.current   = sc.inputTranscription.text;

          // Server-side interruption detected
          if (sc.interrupted) { interrupt(); return; }

          // Turn finished — wait for queued audio to drain then go back to listening
          if (sc.turnComplete) {
            const ctx       = outputCtxRef.current;
            const remaining = ctx ? Math.max(0, (nextPlayRef.current - ctx.currentTime) * 1000) : 0;
            setTimeout(() => {
              if (stateRef.current === 'speaking') go('listening');
              if (heardRef.current || answerRef.current) {
                onTurnComplete(heardRef.current.trim(), answerRef.current.trim());
                heardRef.current  = '';
                answerRef.current = '';
              }
            }, remaining + 300);
          }
        }
      };

      ws.onerror = (e) => {
        console.error('WS error:', e);
        onError('Live API connection error — check API key and console');
        disconnect();
      };

      ws.onclose = (e) => {
        console.warn(`WS close: ${e.code} — ${e.reason}`);
        if (stateRef.current !== 'disconnected') {
          if (e.code !== 1000) onError(`Connection closed (${e.code}): ${e.reason || 'unknown reason'}`);
          go('disconnected');
        }
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onError(msg.includes('Permission') ? 'Microphone access denied — allow mic in browser settings' : msg);
      go('disconnected');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  //  Disconnect & full cleanup 
  const disconnect = useCallback(() => {
    // Stop worklet
    workletRef.current?.port.close();
    workletRef.current?.disconnect();
    workletRef.current = null;
    accBuf.current = [];
    accLen.current = 0;

    // Stop mic
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;

    // Stop all playing audio
    sourcesRef.current.forEach(s => { try { s.stop(0); } catch {} });
    sourcesRef.current = [];
    nextPlayRef.current = 0;

    // Close AudioContexts
    inputCtxRef.current?.close().catch(() => {});
    inputCtxRef.current  = null;
    outputCtxRef.current?.close().catch(() => {});
    outputCtxRef.current = null;
    analyserRef.current  = null;

    // Close WebSocket
    wsRef.current?.close(1000, 'User ended session');
    wsRef.current = null;

    go('disconnected');
  }, []);
  // ADD this before the return:
const wsSend = useCallback((payload: object) => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(JSON.stringify(payload));
  }
}, []);


  return { liveState, connect, disconnect, interrupt , wsSend };
}