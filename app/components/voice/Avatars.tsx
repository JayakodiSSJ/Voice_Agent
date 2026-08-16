'use client';
import { AgentState } from './types';

export function AIAvatar({ state }: { state: AgentState }) {
  const speaking = state === 'speaking';
  const thinking = state === 'thinking';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative w-30 h-30 rounded-2xl flex items-center justify-center transition-all duration-500
        bg-gradient-to-br from-[#0a1628] to-[#0d2240] border border-[#1a5276]/60
        ${speaking ? 'shadow-[0_0_35px_rgba(13,107,58,0.7)]' : thinking ? 'shadow-[0_0_25px_rgba(26,82,118,0.6)]' : 'shadow-[0_0_12px_rgba(26,82,118,0.2)]'}`}
      >
        {/* NEW MODERN HUMANOID AI ICON */}
        <svg viewBox="0 0 80 80" className="w-24 h-24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Main Contoured Humanoid Android Head Silhouette */}
          <path d="M40 72 C20 72 12 50 12 35 C12 15 25 8 40 8 C55 8 68 15 68 35 C68 50 60 72 40 72 Z" fill="#1a5276" opacity="0.95"/>

          {/* Facial Panel Lines defining plated construction */}
          <path d="M12 35 H25 M68 35 H55" stroke="#060B15" strokeWidth="1"/>
          <path d="M40 8 V20" stroke="#060B15" strokeWidth="1"/>
          <path d="M25 35 Q40 45 55 35" stroke="#060B15" strokeWidth="1"/>

          {/* Modern Top/ Forehead Indicator (replacing old stalk) */}
          <circle cx="40" cy="18" r="4" fill="#27ae60" className={speaking ? 'animate-ping' : ''}/>
          <path d="M30 18 H50" stroke={speaking ? '#27ae60' : '#3498db'} strokeWidth="1" strokeDasharray="3 3"/>

          {/* Modern Sleek Eyes */}
          <circle cx="28" cy="38" r="5" fill="#060B15"/>
          <circle cx="52" cy="38" r="5" fill="#060B15"/>
          {/* Eye Pupil / Glow */}
          <circle cx="28" cy="38" r="3.5" fill={speaking ? '#27ae60' : '#3498db'} className={speaking ? 'animate-pulse' : ''}/>
          <circle cx="52" cy="38" r="3.5" fill={speaking ? '#27ae60' : '#3498db'} className={speaking ? 'animate-pulse' : ''}/>

          {/* Dynamic Mouth / Voice Interface */}
          {speaking ? (
            <path d="M25 55 Q40 68 55 55" stroke="#27ae60" strokeWidth="3" className="animate-pulse" fill="none"/>
          ) : (
            <path d="M30 58 Q40 61 50 58" stroke="#0d6b3a" strokeWidth="2" fill="none"/>
          )}

          {/* Refined Side Interfaces (Ears) */}
          <rect x="8" y="32" width="5" height="14" rx="2.5" fill="#0d3a5c"/>
          <rect x="67" y="32" width="5" height="14" rx="2.5" fill="#0d3a5c"/>
        </svg>
        {/* Thinking spinner ring - unchanged */}
        {thinking && <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-[#1a5276] animate-spin" />}
      </div>

      <div className={`flex items-end gap-0 h-5 transition-opacity duration-300 ${speaking ? 'opacity-100' : 'opacity-0'}`}>
        {[10, 16, 22, 18, 12, 20, 14].map((h, i) => (
          <div key={i} className="w-1 rounded-full bg-green-500"
            style={{ height: `${h}px`, animation: `soundbar 0.6s ease-in-out ${i * 0.08}s infinite alternate` }} />
        ))}
      </div>
      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">AI Agent</span>
    </div>
  );
}

{/* UserAvatar remains identical to original code */}
export function UserAvatar({ state }: { state: AgentState }) {
  const recording = state === 'recording';
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative w-30 h-30 rounded-2xl flex items-center justify-center transition-all duration-500
        bg-gradient-to-br from-[#1a0d2e] to-[#2c1654] border border-white/10
        ${recording ? 'shadow-[0_0_35px_rgba(239,68,68,0.7)]' : 'shadow-[0_0_10px_rgba(255,255,255,0.04)]'}`}
      >
        <svg viewBox="0 0 80 80" className="w-24 h-24">
          <circle cx="40" cy="30" r="18" fill="#c8956c"/>
          <ellipse cx="40" cy="14" rx="18" ry="10" fill="#2d1a0a"/>
          <circle cx="33" cy="28" r="3" fill="#1a0a00"/>
          <circle cx="47" cy="28" r="3" fill="#1a0a00"/>
          <path d="M33 36 Q40 42 47 36" stroke="#8b5e3c" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <path d="M18 70 Q18 54 40 52 Q62 54 62 70" fill="#4a5568"/>
          <path d="M32 52 L40 60 L48 52" fill="#2d3748"/>
        </svg>
        {recording && <div className="absolute inset-0 rounded-2xl border-2 border-red-500 animate-ping opacity-60" />}
      </div>

      <div className={`flex items-end gap-0.5 h-5 transition-opacity duration-300 ${recording ? 'opacity-100' : 'opacity-0'}`}>
        {[8, 14, 20, 16, 10].map((h, i) => (
          <div key={i} className="w-1 rounded-full bg-red-400"
            style={{ height: `${h}px`, animation: `soundbar 0.5s ease-in-out ${i * 0.1}s infinite alternate` }} />
        ))}
      </div>
      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">You</span>
    </div>
  );
}