'use client';
import Image from 'next/image';
import { AppLanguage, LANGUAGES } from './types';

interface Props {
  sidebarOpen:      boolean;
  onToggleSidebar:  () => void;
  turnCount:        number;
  language:         AppLanguage;
  onLanguageChange: (lang: AppLanguage) => void;
}

export default function Navbar({ sidebarOpen, onToggleSidebar, turnCount, language, onLanguageChange }: Props) {
  return (
    <header
      className="h-12 sm:h-14 shrink-0 flex items-center justify-between px-3 sm:px-5 w-full relative z-30"
      style={{ background: 'rgba(6,11,21,0.97)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)' }}
    >
      {/* left */}
      <div className="flex items-center gap-2 sm:gap-10 min-w-0">
        <button onClick={onToggleSidebar}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/08 transition shrink-0 text-sm">
          {sidebarOpen ? '✕' : '☰'}
        </button>

        <Image src="/logo.png" alt="SLT Mobitel" width={70} height={70} className="object-contain shrink-0 sm:w-[80px] sm:h-[72px]" priority />

        <div className="hidden sm:flex items-center gap-8 ml-1">
          <div className="flex flex-col gap-[3px]">
            <span className="w-[5px] h-2.5 rounded-full" style={{ background: '#0070B8' }} />
            <span className="w-[5px] h-2.5 rounded-full" style={{ background: '#00A651' }} />
            <span className="w-[5px] h-2.5 rounded-full" style={{ background: '#F5A623' }} />
          </div>
          <span className="text-white/85 text-[16px] font-semibold tracking-[0.12em] uppercase">Voice AI Agent</span>
        </div>
      </div>

      {/* right */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

        {turnCount > 0 && (
          <span className="hidden sm:block text-[10px] text-white/30 font-medium px-2 py-0.5 rounded-full"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {turnCount} turns
          </span>
        )}

        {/* language pills — compact on mobile */}
        <div className="flex items-center gap-0.5 rounded-full p-[2px] sm:p-[3px]"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {Object.values(LANGUAGES).map(lang => (
            <button key={lang.code} onClick={() => onLanguageChange(lang.code)}
              className="px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold transition-all duration-200"
              style={language === lang.code ? {
                background: 'linear-gradient(135deg,#0070B8,#00A651)',
                color: '#fff',
                boxShadow: '0 2px 8px rgba(0,112,184,0.35)',
              } : { color: 'rgba(255,255,255,0.45)' }}>
              {/* on mobile show flag, on desktop show full label */}
              <span className="sm:hidden">{lang.flag}</span>
              <span className="hidden sm:inline">{lang.nativeLabel}</span>
            </button>
          ))}
        </div>

        {/* live badge */}
        <div className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full"
          style={{ background: 'linear-gradient(135deg,rgba(0,112,184,0.18),rgba(0,166,81,0.18))', border: '1px solid rgba(0,166,81,0.35)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#00A651] animate-pulse" />
          <span className="text-[10px] sm:text-[11px] font-bold text-white/90 tracking-wide">
            <span className="hidden sm:inline">{LANGUAGES[language].flag} </span>Live
          </span>
        </div>
      </div>

      {/* bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ background: 'linear-gradient(90deg,#0070B8 0%,#00A651 50%,#F5A623 100%)' }} />
    </header>
  );
}