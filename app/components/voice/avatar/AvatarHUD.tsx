import { AgentState } from '../types';

interface LabelProps { state: AgentState; msg: string; theme: 'dark' | 'light'; }
interface WaveProps  { state: AgentState; }

export function StatusLabel({ state, msg, theme }: LabelProps) {
  const color = theme === 'light'
    ? { idle: 'text-black/40', recording: 'text-red-500', thinking: 'text-blue-500', speaking: 'text-green-600' }[state]
    : { idle: 'text-white/30', recording: 'text-red-400', thinking: 'text-blue-400', speaking: 'text-green-400' }[state];
  const dot = theme === 'light'
    ? { idle: 'bg-black/20', recording: 'bg-red-500 animate-ping', thinking: 'bg-blue-500 animate-pulse', speaking: 'bg-green-500 animate-pulse' }[state]
    : { idle: 'bg-white/20', recording: 'bg-red-400 animate-ping', thinking: 'bg-blue-400 animate-pulse', speaking: 'bg-green-400 animate-pulse' }[state];
  return (
    <div className="flex items-center gap-2 justify-center mt-3">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className={`text-xs font-medium tracking-widest uppercase ${color}`}>{msg}</span>
    </div>
  );
}

export function SoundWaves({ state }: WaveProps) {
  if (state !== 'speaking' && state !== 'recording') return null;
  const color = state === 'speaking' ? '#00A651' : '#ef4444';
  return (
    <div className="flex items-end justify-center gap-0.5 h-8 mt-2">
      {[4, 8, 14, 20, 16, 10, 6, 12, 18, 14, 8, 4].map((h, i) => (
        <div key={i} className="w-1 rounded-full" style={{
          height: `${h}px`, backgroundColor: color,
          animation: `soundbar ${0.4 + (i % 3) * 0.15}s ease-in-out ${i * 0.05}s infinite alternate`,
          opacity: 0.7 + (i % 2) * 0.3,
        }} />
      ))}
    </div>
  );
}