'use client';
import { useRef, useEffect } from 'react';
import { Turn, AppLanguage } from './types';
import ChatBubble from './ChatBubble';

interface Props {
  turns: Turn[];
  chatOpen: boolean;
  setChatOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  state: string;
  onReplay: (text: string, lang: AppLanguage) => void;
}

export default function FloatingChat({ turns, chatOpen, setChatOpen, state, onReplay }: Props) {
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom on new turns
  useEffect(() => {
    if (chatOpen && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [turns, chatOpen]);

  // Auto-open when new turn arrives
  useEffect(() => {
    if (turns.length > 0) setChatOpen(true);
  }, [turns.length]);

  return (
    <div className="absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2">

      {/* Slide-up panel */}
      {chatOpen && (
        <div
          className="chat-panel-enter w-[340px] sm:w-[400px] rounded-2xl overflow-hidden flex flex-col"
          style={{
            maxHeight: '55vh',
            background: 'linear-gradient(180deg, rgba(6,11,21,0.97) 0%, rgba(8,17,31,0.97) 100%)',
            border: '1px solid rgba(0,166,81,0.18)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,166,81,0.08)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400"
                style={{ boxShadow: '0 0 6px rgba(0,166,81,0.8)' }} />
              <span className="text-xs font-semibold text-white/70 tracking-wider uppercase">
                Conversation
              </span>
              {turns.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                  {turns.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 transition-all text-sm"
            >
              ✕
            </button>
          </div>

          {/* Scrollable turns */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {turns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 gap-2 opacity-40">
                <span className="text-2xl">💬</span>
                <p className="text-xs text-white/50">No conversation yet</p>
              </div>
            ) : (
              turns.map(turn => (
                <ChatBubble
                  key={turn.id}
                  turn={turn}
                  onReplay={(text) => onReplay(text, turn.lang)}
                />
              ))
            )}
            <div ref={chatBottomRef} />
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setChatOpen(o => !o)}
        className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 ${
          chatOpen
            ? 'bg-green-500/20 border border-green-500/50 shadow-[0_0_20px_rgba(0,166,81,0.3)]'
            : 'bg-[#0d1f36] border border-white/10 hover:border-green-500/40 hover:bg-green-500/10'
        } ${state === 'speaking' && !chatOpen ? 'pulse-ring' : ''}`}
        title={chatOpen ? 'Close chat' : 'View conversation'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke={chatOpen ? '#00A651' : 'rgba(255,255,255,0.5)'}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>

        {!chatOpen && turns.length > 0 && (
          <span
            key={turns.length}
            className="badge-pop absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-green-500 text-[10px] font-bold text-white flex items-center justify-center px-1"
            style={{ boxShadow: '0 2px 8px rgba(0,166,81,0.6)' }}
          >
            {turns.length > 9 ? '9+' : turns.length}
          </span>
        )}
      </button>
    </div>
  );
}