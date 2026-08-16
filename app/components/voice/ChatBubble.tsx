'use client';
import { Turn } from './types';

interface Props {
  turn: Turn;
  onReplay: (text: string) => void;
}

export default function ChatBubble({ turn, onReplay }: Props) {
  const time = turn.timestamp.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-400 mb-6">
      
      {/* user — right */}
      <div className="flex flex-col items-end w-full">
        {/* Row for Bubble + Avatar */}
        <div className="flex justify-end gap-2.5 items-end w-full">
          <div className="max-w-[75%] space-y-1 flex flex-col items-end">
            {turn.file && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-300 text-xs w-fit">
                <span>{turn.file.type.includes('pdf') ? '📄' : '🖼️'}</span>
                <span className="truncate font-medium">{turn.file.name}</span>
              </div>
            )}
            <div className="px-4 py-2.5 rounded-2xl rounded-br-sm border border-[#1a5276]/40 text-left"
              style={{ background: 'linear-gradient(135deg,#0f2a4a,#0d1f36)' }}>
              <p className="text-sm text-white/75 italic">"{turn.heard}"</p>
            </div>
          </div>
          {/* Avatar */}
          <div className="w-7 h-7 rounded-lg bg-[#1a0d2e] border border-white/10 flex items-center justify-center text-sm shrink-0">👤</div>
        </div>
        
        {/* Timestamp pulled outside the row, aligned under the text bubble */}
        <div className="pr-[38px] mt-1">
          <p className="text-[10px] text-white/20 text-right">{time}</p>
        </div>
      </div>

      {/* ai left */}
      {/*  pl-4 sm:pl-6 to shift the entire AI block slightly to the right */}
      <div className="flex flex-col w-full mt-2 items-start pl-4 sm:pl-4 lg:pl-4 xl:pl-20">
        {/* Row for Avatar + Bubble */}
        <div className="flex justify-start gap-2.5 items-end w-full">
          {/* Avatar */}
          <div className="w-7 h-7 rounded-lg border border-[#1a5276]/40 flex items-center justify-center text-sm shrink-0 "
            style={{ background: 'linear-gradient(135deg,#0a1628,#0d2240)' }}>🧑‍💼</div>
          <div className="max-w-[75%] space-y-1">
            <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm border border-green-900/40"
              style={{ background: 'linear-gradient(135deg,#071a0e,#091a0d)' }}>
              <p className="text-sm text-white/75 leading-relaxed">{turn.answer}</p>
            </div>
          </div>
        </div>
        
        {/* Timestamp & Replay pulled outside the row, aligned under the text bubble */}
        <div className="pl-[38px] mt-1 flex items-center gap-2">
          <p className="text-[10px] text-white/20">{time}</p>
          <button onClick={() => onReplay(turn.answer)}
            className="text-[10px] text-white/20 hover:text-green-400 transition flex items-center gap-1 font-medium">
            🔊 replay
          </button>
        </div>
      </div>

    </div>
  );
}