'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AgentState, AppLanguage, LANGUAGES, Turn } from './components/voice/types';
import Navbar       from './components/voice/Navbar';
import Sidebar      from './components/voice/Sidebar';
import AvatarStage  from './components/voice/AvatarStage';
import InputBar     from './components/voice/InputBar';
import FloatingChat from './components/voice/FloatingChat';
import { useGeminiLive, LiveState } from './hooks/useGeminiLive';
import WebcamView   from './components/WebcamView';
import { UserEmotion, Presence } from './hooks/useFaceDetection';

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('voice_session_id');
  if (!id) {
    id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('voice_session_id', id);
  }
  return id;
}

function toAgentState(ls: LiveState): AgentState {
  if (ls === 'speaking')   return 'speaking';
  if (ls === 'thinking')   return 'thinking';
  if (ls === 'listening')  return 'recording';
  if (ls === 'connecting') return 'thinking';
  return 'idle';
}

export default function VoicePage() {
  const [turns,        setTurns]        = useState<Turn[]>([]);
  const [error,        setError]        = useState('');
  const [sessionId,    setSessionId]    = useState('');
  const [sidebarOpen,  setSidebarOpen]  = useState(false); // closed by default on mobile
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [chatOpen,     setChatOpen]     = useState(false);
  const [theme,        setTheme]        = useState<'dark' | 'light'>('dark');
  const [language,     setLanguage]     = useState<AppLanguage>('en');
  const lastEmotionRef = useRef<{ emotion: string; time: number }>({ emotion: '', time: 0 });

  useEffect(() => { setSessionId(getSessionId()); }, []);

  const { liveState, connect, disconnect, interrupt, wsSend } = useGeminiLive({
    language,
    onTurnComplete: (heard, answer) => {
      setTurns(prev => [...prev, { id: Date.now(), heard, answer, lang: language, timestamp: new Date() }]);
    },
    onError: (msg) => setError(msg),
  });

  const agentState  = toAgentState(liveState);
  const isConnected = liveState !== 'disconnected';

  const statusMsg: Record<AgentState, string> = {
    idle:      'Click the button to start',
    recording: `${LANGUAGES[language].nativeLabel} — Listening...`,
    thinking:  'Searching & thinking...',
    speaking:  'Speaking — click to interrupt',
  };

  const handleLanguageChange = (lang: AppLanguage) => {
    if (isConnected) disconnect();
    setLanguage(lang);
    setError('');
  };

  const handlePresenceChange = useCallback((presence: Presence) => {
    
  }, []);

  const handleEmotionChange = useCallback((emotion: UserEmotion, confidence: number) => {
    
    const now = Date.now();
    if (emotion === lastEmotionRef.current.emotion && now - lastEmotionRef.current.time < 30000) return;
    if (!isConnected) return;
    if (confidence < 0.65 || emotion === 'neutral') return;
    lastEmotionRef.current = { emotion, time: now };

    const hints: Partial<Record<UserEmotion, string>> = {
      happy:     'The camera shows the user is smiling and looks happy. Say something warm like "I can see you\'re in a great mood today! That\'s wonderful."',
      confused:  'The camera shows the user looks confused. Say "You seem a little unsure. Let me try to explain that more clearly for you."',
      surprised: 'The camera shows the user looks surprised. Say "You look a bit surprised! Is everything okay? I\'m happy to explain anything."',
      sad:       'The camera shows the user looks sad. Say "I can see you seem a bit down. I\'m here for you — what can I help with?"',
      angry:     'The camera shows the user looks frustrated. Say "I can see you\'re frustrated and I completely understand. I\'m going to do everything I can to help you right now."',
    };

    const hint = hints[emotion];
    if (!hint || !wsSend) return;
    wsSend({ clientContent: { turns: [{ role: 'user', parts: [{ text: hint }] }], turnComplete: true } });
    
  }, [isConnected, wsSend]);

  const clearSession = () => {
    disconnect();
    localStorage.removeItem('voice_session_id');
    setSessionId(getSessionId());
    setTurns([]);
    setChatOpen(false);
    setError('');
  };

  const replayTurn = (text: string, lang: AppLanguage) => {
    if (isConnected) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, ''));
    utt.lang  = LANGUAGES[lang].bcp47;
    utt.rate  = lang === 'si' ? 0.85 : lang === 'ta' ? 0.88 : 0.95;
    window.speechSynthesis.speak(utt);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');
        *, body { font-family: 'Poppins', sans-serif !important; margin: 0; box-sizing: border-box; }
        @keyframes soundbar  { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }
        @keyframes live-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        .live-pulse { animation: live-pulse 1.2s ease-in-out infinite; }
        @keyframes chat-slide-up   { from { opacity:0; transform:translateY(24px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes chat-slide-down { from { opacity:1; transform:translateY(0) scale(1); } to { opacity:0; transform:translateY(24px) scale(0.97); } }
        .chat-panel-enter { animation: chat-slide-up   0.28s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .chat-panel-exit  { animation: chat-slide-down 0.22s ease-in forwards; }
        @keyframes badge-pop  { 0%{transform:scale(0)} 70%{transform:scale(1.25)} 100%{transform:scale(1)} }
        .badge-pop { animation: badge-pop 0.3s ease-out forwards; }
        @keyframes pulse-ring { 0%{box-shadow:0 0 0 0 rgba(0,166,81,0.55)} 70%{box-shadow:0 0 0 10px rgba(0,166,81,0)} 100%{box-shadow:0 0 0 0 rgba(0,166,81,0)} }
        .pulse-ring { animation: pulse-ring 1.6s ease-out infinite; }
        * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.07) transparent; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(13,107,58,0.4); }
      `}</style>

      <div className={`h-[100dvh] text-white flex flex-col overflow-hidden ${
        theme === 'light' ? 'bg-[#f0f4f8]' : 'bg-[#060B15]'
      }`}>

        {/* ── Navbar — always full width ── */}
        <Navbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(s => !s)}
          turnCount={turns.length}
          language={language}
          onLanguageChange={handleLanguageChange}
        />

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Sidebar — slides over on mobile, fixed width on desktop */}
          <Sidebar
            open={sidebarOpen}
            turns={turns}
            sessionId={sessionId}
            onNewSession={clearSession}
          />

          {/* ── Main content ── */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">

            {/* Avatar — fills remaining height */}
            <div className="flex-1 relative min-h-0 overflow-hidden">
              <AvatarStage
                state={agentState}
                statusMsg={statusMsg[agentState]}
                theme={theme}
              />

              <WebcamView
                isLive={isConnected}
                onPresenceChange={handlePresenceChange}
                onEmotionChange={handleEmotionChange}
              />

              <FloatingChat
                turns={turns}
                chatOpen={chatOpen}
                setChatOpen={setChatOpen}
                state={agentState}
                onReplay={replayTurn}
              />

              {/* theme toggle */}
              <button
                onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                className="absolute top-3 right-3 z-30 w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border transition-all text-sm"
                style={{
                  background:  theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
                  borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)'  : 'rgba(0,0,0,0.12)',
                }}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>

              {/* mobile sidebar overlay — tap outside to close */}
              {sidebarOpen && (
                <div
                  className="absolute inset-0 z-20 sm:hidden"
                  style={{ background: 'rgba(0,0,0,0.5)' }}
                  onClick={() => setSidebarOpen(false)}
                />
              )}
            </div>

            {/* ── Input bar — always at bottom ── */}
            <div className="w-full shrink-0 z-20 relative" style={{ boxShadow: '0 -20px 40px rgba(6,11,21,0.8)' }}>
              <InputBar
                liveState={liveState}
                error={error}
                attachedFile={attachedFile}
                onFileChange={setAttachedFile}
                onConnect={connect}
                onDisconnect={disconnect}
                onInterrupt={interrupt}
              />
            </div>

          </div>
        </div>
      </div>
    </>
  );
}