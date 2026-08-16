'use client';
import { Turn, AppLanguage } from './types';

interface Props {
  open:         boolean;
  turns:        Turn[];
  sessionId:    string;
  onNewSession: () => void;
}

export default function Sidebar({ open, turns, sessionId, onNewSession }: Props) {
  if (!open) return null;

  return (
    <>
      {/* sidebar panel — full overlay on mobile, fixed width on desktop */}
      <aside
        className="
          absolute sm:relative z-20 sm:z-auto
          w-[80vw] max-w-[280px] sm:w-60
          h-full shrink-0
          flex flex-col overflow-hidden
        "
        style={{
          background:   'rgba(6,11,21,0.98)',
          borderRight:  '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* header */}
        <div className="px-4 py-3 border-b shrink-0 flex items-center justify-between"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Conversations</span>
          <span className="text-[10px] text-white/30 bg-white/08 px-2 py-0.5 rounded-full">{turns.length}</span>
        </div>

        {/* new session */}
        <div className="px-3 py-2 shrink-0">
          <button onClick={onNewSession}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white/50 hover:text-white hover:bg-white/08 transition border border-white/08">
            <span>+</span> New Conversation
          </button>
        </div>

        {/* turns list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
          {turns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-white/20">no conversations yet</p>
              <p className="text-[10px] text-white/12 mt-1">start talking to see history</p>
            </div>
          ) : (
            turns.map((t, i) => (
              <div key={t.id}
                className="px-3 py-2 rounded-xl border text-xs cursor-pointer transition hover:border-white/15"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white/30 text-[10px] font-mono">
                    {i + 1}. {t.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {t.heard && (
                  <p className="text-white/50 truncate text-[11px]">"{t.heard}"</p>
                )}
                {t.answer && (
                  <p className="text-white/30 truncate text-[10px] mt-0.5">{t.answer}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* session info */}
        <div className="px-4 py-2 border-t shrink-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/08 flex items-center justify-center text-[10px] font-bold text-white/40">N</div>
            <div className="min-w-0">
              <p className="text-[10px] text-white/30 truncate">memory · {turns.length} turns stored</p>
              <p className="text-[9px] text-white/15 truncate">{sessionId}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}