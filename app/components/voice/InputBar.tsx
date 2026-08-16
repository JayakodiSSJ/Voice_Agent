'use client';
import { useRef, useEffect, useState } from 'react';
import { LiveState } from '../../hooks/useGeminiLive';

interface Props {
  liveState:    LiveState;
  error:        string;
  attachedFile: File | null;
  onFileChange: (f: File | null) => void;
  onConnect:    () => void;
  onDisconnect: () => void;
  onInterrupt:  () => void;
}

function useCallTimer(active: boolean) {
  const [sec, setSec] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (active) { setSec(0); ref.current = setInterval(() => setSec(s => s + 1), 1000); }
    else { if (ref.current) clearInterval(ref.current); setSec(0); }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [active]);
  return `${String(Math.floor(sec / 60)).padStart(2,'0')}:${String(sec % 60).padStart(2,'0')}`;
}

function SpinRing() {
  return (
    <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/80 shrink-0"
      style={{ animation: 'spin 0.8s linear infinite' }} />
  );
}

export default function InputBar({ liveState, error, attachedFile, onFileChange, onConnect, onDisconnect, onInterrupt }: Props) {
  const fileRef     = useRef<HTMLInputElement>(null);
  const isConnected = liveState !== 'disconnected';
  const callTimer   = useCallTimer(isConnected && liveState !== 'connecting');

  return (
    <div className="shrink-0 border-t px-0 py-3 relative"
      style={{ background: 'rgba(6,11,21,0.97)', backdropFilter: 'blur(12px)', borderColor: 'rgba(255,255,255,0.06)' }}>

      {/* top accent line — matches navbar */}
      <div className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: 'linear-gradient(90deg,#0070B8 0%,#00A651 50%,#F5A623 100%)', opacity: 0.4 }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div className="max-w-4xl mx-auto flex items-center gap-3 w-full">

        {/* file attach */}
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={e => onFileChange(e.target.files?.[0] ?? null)} />
        <button onClick={() => fileRef.current?.click()} title="Attach file"
          className={`w-9 h-9 rounded-xl border flex items-center justify-center text-base transition shrink-0 ${
            attachedFile
              ? 'border-purple-500/50 bg-purple-500/15 text-purple-300'
              : 'border-white/[0.08] bg-white/[0.03] text-white/30 hover:text-white/60 hover:border-white/20'
          }`}>
          {attachedFile ? '📎' : '📂'}
        </button>

        {/* file pill */}
        {attachedFile && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs shrink-0">
            <span className="truncate max-w-[100px] font-medium">{attachedFile.name}</span>
            <button onClick={() => onFileChange(null)} className="hover:text-red-400 transition">✕</button>
          </div>
        )}

        {/* spacer pushes buttons to the right */}
        <div className="flex-1" />

        {/* right side — timer + interrupt + main button */}
        <div className="flex items-center gap-3 shrink-0">

          {/* timer — left of the button */}
          {isConnected && liveState !== 'connecting' && (
            <span className="text-sm font-mono font-semibold tabular-nums"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              {callTimer}
            </span>
          )}

          {/* interrupt — only when Gemini is speaking */}
          {liveState === 'speaking' && (
            <button onClick={onInterrupt}
              className="px-3 h-10 rounded-2xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(245,166,35,0.12)',
                border:     '1px solid rgba(245,166,35,0.3)',
                color:      '#F5A623',
              }}>
              ⏸ Interrupt
            </button>
          )}

          {/* ── MAIN BUTTON — single button that changes per state ── */}

          {liveState === 'disconnected' && (
            <button onClick={onConnect}
              className="flex items-center gap-2 px-5 h-10 rounded-2xl font-semibold text-sm text-white transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg,#0070B8,#005a93)',
                boxShadow:  '0 0 20px rgba(0,112,184,0.35)',
              }}>
              <span>🎙️</span>
              <span>Start Conversation</span>
            </button>
          )}

          {liveState === 'connecting' && (
            <button disabled
              className="flex items-center gap-2 px-5 h-10 rounded-2xl font-semibold text-sm text-white/50 cursor-not-allowed"
              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}>
              <SpinRing />
              <span>Connecting...</span>
            </button>
          )}

          {liveState === 'listening' && (
            <button onClick={onDisconnect}
              className="flex items-center gap-2 px-5 h-10 rounded-2xl font-semibold text-sm transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(239,68,68,0.15)',
                border:     '1px solid rgba(239,68,68,0.35)',
                color:      '#f87171',
              }}>
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
              <span>End Call</span>
            </button>
          )}

          {liveState === 'thinking' && (
            <button onClick={onDisconnect}
              className="flex items-center gap-2 px-5 h-10 rounded-2xl font-semibold text-sm transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(239,68,68,0.15)',
                border:     '1px solid rgba(239,68,68,0.35)',
                color:      '#f87171',
              }}>
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
              <span>End Call</span>
            </button>
          )}

          {liveState === 'speaking' && (
            <button onClick={onDisconnect}
              className="flex items-center gap-2 px-5 h-10 rounded-2xl font-semibold text-sm transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(239,68,68,0.15)',
                border:     '1px solid rgba(239,68,68,0.35)',
                color:      '#f87171',
              }}>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
              <span>End Call</span>
            </button>
          )}

        </div>
      </div>

      {/* error */}
      {error && (
        <p className="text-center text-xs text-red-400 mt-2 max-w-3xl mx-auto font-medium">⚠️ {error}</p>
      )}

      
    </div>
  );
}