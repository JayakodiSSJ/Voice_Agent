'use client';
// components/WebcamView.tsx
// click drag to move anywhere, click resize button to toggle size


import { useRef, useEffect, useState, useCallback } from 'react';
import { useFaceDetection, UserEmotion, Presence } from '../hooks/useFaceDetection';

interface Props {
  onPresenceChange?: (p: Presence) => void;
  onEmotionChange?:  (e: UserEmotion, confidence: number) => void;
  isLive?: boolean;
}

const EMOTION_CFG: Record<UserEmotion, { label: string; color: string; emoji: string }> = {
  neutral:   { label: 'Neutral',   color: '#ffffff50', emoji: '😐' },
  happy:     { label: 'Happy',     color: '#00A651',   emoji: '😊' },
  surprised: { label: 'Surprised', color: '#F5A623',   emoji: '😮' },
  confused:  { label: 'Confused',  color: '#0070B8',   emoji: '🤔' },
  sad:       { label: 'Sad',       color: '#6366f1',   emoji: '😢' },
  angry:     { label: 'Angry',     color: '#ef4444',   emoji: '😠' },
  fearful:   { label: 'Fearful',   color: '#8b5cf6',   emoji: '😨' },
};

// size presets — small (pip), medium, large (video call style)
const SIZES = [
  { w: 120, h: 90,  label: 'PiP'    },
  { w: 220, h: 165, label: 'Medium' },
  { w: 380, h: 285, label: 'Large'  },
];

export default function WebcamView({ onPresenceChange, onEmotionChange, isLive = false }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [camReady,   setCamReady]   = useState(false);
  const [sizeIdx,    setSizeIdx]    = useState(0); // 0=pip 1=medium 2=large
  const [minimized,  setMinimized]  = useState(false);

  // drag state
  const [pos,       setPos]       = useState({ x: 16, y: -1 }); // -1 = use default bottom
  const dragRef     = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  // start/stop webcam
  useEffect(() => {
    if (isLive) {
      navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            setCamReady(true);
            
          }
        })
        .catch(err => console.warn('webcam denied:', err));
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setCamReady(false);
    }
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [isLive]);

  const { result, modelsLoaded } = useFaceDetection(
    videoRef as React.RefObject<HTMLVideoElement>,
    { onPresenceChange, onEmotionChange, intervalMs: 2000 }
  );

  //  drag handlers 
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // only drag on the header bar area
    dragRef.current = {
      dragging: true,
      startX:   e.clientX,
      startY:   e.clientY,
      origX:    pos.x,
      origY:    pos.y === -1 ? window.innerHeight - SIZES[sizeIdx].h - 80 : pos.y,
    };
    e.preventDefault();
  }, [pos, sizeIdx]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newX = Math.max(0, Math.min(window.innerWidth  - SIZES[sizeIdx].w, dragRef.current.origX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - SIZES[sizeIdx].h, dragRef.current.origY + dy));
      setPos({ x: newX, y: newY });
    };
    const onUp = () => { dragRef.current.dragging = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    // touch support
    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current.dragging) return;
      const t = e.touches[0];
      const dx = t.clientX - dragRef.current.startX;
      const dy = t.clientY - dragRef.current.startY;
      const newX = Math.max(0, Math.min(window.innerWidth  - SIZES[sizeIdx].w, dragRef.current.origX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - SIZES[sizeIdx].h, dragRef.current.origY + dy));
      setPos({ x: newX, y: newY });
    };
    const onTouchEnd = () => { dragRef.current.dragging = false; };
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend',  onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend',  onTouchEnd);
    };
  }, [sizeIdx]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    dragRef.current = {
      dragging: true,
      startX:   t.clientX,
      startY:   t.clientY,
      origX:    pos.x,
      origY:    pos.y === -1 ? window.innerHeight - SIZES[sizeIdx].h - 80 : pos.y,
    };
  }, [pos, sizeIdx]);

  if (!isLive) return null;

  const size      = SIZES[sizeIdx];
  const isPresent = result.presence === 'present';
  const eCfg      = EMOTION_CFG[result.emotion];
  const top       = pos.y === -1 ? undefined : pos.y;
  const bottom    = pos.y === -1 ? 80 : undefined;

  return (
    <div
      ref={containerRef}
      className="fixed z-40 select-none"
      style={{
        left:       pos.x,
        top,
        bottom,
        width:      minimized ? 48 : size.w,
        height:     minimized ? 48 : size.h + 52, // +52 for header+footer
        transition: 'width 0.25s ease, height 0.25s ease',
        cursor:     dragRef.current.dragging ? 'grabbing' : 'default',
      }}
    >
      {/*  outer shell  */}
      <div
        className="w-full h-full rounded-2xl overflow-hidden flex flex-col"
        style={{
          background:  'rgba(6,11,21,0.92)',
          border:      `2px solid ${isPresent ? '#00A651' : 'rgba(255,255,255,0.12)'}`,
          boxShadow:   isPresent
            ? '0 0 20px rgba(0,166,81,0.25), 0 8px 32px rgba(0,0,0,0.5)'
            : '0 8px 32px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)',
          transition:  'border-color 0.4s ease, box-shadow 0.4s ease',
        }}
      >
        {/*  drag handle / header  */}
        <div
          className="flex items-center justify-between px-2 py-1.5 shrink-0 cursor-grab active:cursor-grabbing"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          {/* presence dot + label */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: isPresent ? '#00A651' : '#ef4444',
                boxShadow:       isPresent ? '0 0 5px #00A651' : 'none',
                animation:       isPresent ? 'live-pulse 1.4s ease-in-out infinite' : 'none',
              }}
            />
            {!minimized && (
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">
                {isPresent ? 'You' : 'No face'}
              </span>
            )}
          </div>

          {/* controls */}
          <div className="flex items-center gap-1">
            {/* cycle size */}
            {!minimized && (
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => setSizeIdx(i => (i + 1) % SIZES.length)}
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] text-white/40 hover:text-white transition"
                title={`Switch to ${SIZES[(sizeIdx + 1) % SIZES.length].label}`}
              >
                {sizeIdx === 0 ? '⛶' : sizeIdx === 1 ? '⊞' : '⊟'}
              </button>
            )}
            {/* minimize / restore */}
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setMinimized(m => !m)}
              className="w-5 h-5 rounded flex items-center justify-center text-[10px] text-white/40 hover:text-white transition"
              title={minimized ? 'Restore' : 'Minimize'}
            >
              {minimized ? '📷' : '—'}
            </button>
          </div>
        </div>

        {/*  video  */}
        {!minimized && (
          <>
            <div className="relative flex-1 overflow-hidden">
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />

              {/* head pose badge */}
              {result.headPose !== 'still' && isPresent && (
                <div
                  className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: 'rgba(0,0,0,0.7)', color: '#F5A623' }}
                >
                  {result.headPose === 'nodding' ? '↕ Nod' : '↔ Shake'}
                </div>
              )}

              {/* loading overlay */}
              {!modelsLoaded && camReady && (
                <div className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <span className="text-[10px] text-white/50">Loading AI...</span>
                </div>
              )}
            </div>

            {/*  emotion footer  */}
            <div
              className="shrink-0 flex items-center justify-between px-2 py-1"
              style={{ background: 'rgba(0,0,0,0.35)' }}
            >
              {isPresent && modelsLoaded ? (
                <>
                  <div className="flex items-center gap-1">
                    <span className="text-sm">{eCfg.emoji}</span>
                    <span className="text-[10px] font-semibold" style={{ color: eCfg.color }}>
                      {eCfg.label}
                    </span>
                  </div>
                  <span className="text-[9px] text-white/30 font-mono">
                    {(result.confidence * 100).toFixed(0)}%
                  </span>
                </>
              ) : (
                <span className="text-[9px] text-white/25 mx-auto">
                  {!isPresent ? 'No face detected' : 'Analyzing...'}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}