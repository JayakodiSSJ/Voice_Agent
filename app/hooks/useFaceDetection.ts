'use client';
// hooks/useFaceDetection.ts
// detects presence, emotion, head nod/shake
// models load from /public/models/ folder

import { useRef, useCallback, useEffect, useState } from 'react';

export type UserEmotion = 'neutral' | 'happy' | 'surprised' | 'confused' | 'sad' | 'angry' | 'fearful';
export type HeadPose    = 'still' | 'nodding' | 'shaking';
export type Presence    = 'present' | 'absent';

export interface FaceDetectionResult {
  presence:  Presence;
  emotion:   UserEmotion;
  headPose:  HeadPose;
  confidence: number; // 0-1 how confident the emotion detection is
}

interface Options {
  onPresenceChange?: (p: Presence) => void;
  onEmotionChange?:  (e: UserEmotion, confidence: number) => void;
  intervalMs?: number; // how often to run detection, default 2000ms
}

// map face-api expression keys → our emotion type
function mapExpression(expressions: Record<string, number>): { emotion: UserEmotion; confidence: number } {
  const map: Record<string, UserEmotion> = {
    neutral:   'neutral',
    happy:     'happy',
    surprised: 'surprised',
    sad:       'sad',
    angry:     'angry',
    fearful:   'fearful',
    disgusted: 'confused', // map disgusted → confused 
  };

  let best = 'neutral';
  let bestScore = 0;
  for (const [key, score] of Object.entries(expressions)) {
    if (score > bestScore) { bestScore = score; best = key; }
  }

  return { emotion: map[best] ?? 'neutral', confidence: bestScore };
}

export function useFaceDetection(videoRef: React.RefObject<HTMLVideoElement | null>, opts: Options = {}) {
  const { onPresenceChange, onEmotionChange, intervalMs = 2000 } = opts;

  const [result, setResult] = useState<FaceDetectionResult>({
    presence:   'absent',
    emotion:    'neutral',
    headPose:   'still',
    confidence: 0,
  });

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError]               = useState('');

  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPresenceRef = useRef<Presence>('absent');
  const prevEmotionRef  = useRef<UserEmotion>('neutral');

  // head nod detection via landmark y-position history
  const headYHistory  = useRef<number[]>([]);
  const headYXHistory = useRef<number[]>([]);

  // load models from /public/models/
  const loadModels = useCallback(async () => {
    try {
      // dynamic import — avoids SSR crash since face-api uses browser APIs
      const faceapi = await import('face-api.js');
      const MODEL_URL = '/models';

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL), // for head pose
      ]);

      
      setModelsLoaded(true);
    } catch (err) {
      console.error('❌ face-api model load failed:', err);
      setError('Could not load face detection models — check /public/models/ folder');
    }
  }, []);

  // run one detection frame
  const detect = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 1 || video.videoWidth === 0) return; // video not ready

    try {
      const faceapi = await import('face-api.js');

      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.2 }))
        .withFaceLandmarks(true)   // tiny landmark model
        .withFaceExpressions();

      //  PRESENCE 
      const presence: Presence = detection ? 'present' : 'absent';
      if (presence !== prevPresenceRef.current) {
        prevPresenceRef.current = presence;
        onPresenceChange?.(presence);
        
      }

      if (!detection) {
        setResult(r => ({ ...r, presence: 'absent' }));
        return;
      }

      // EMOTION 
      const { emotion, confidence } = mapExpression(detection.expressions as unknown as Record<string, number>);
      if (emotion !== prevEmotionRef.current && confidence > 0.55) {
        prevEmotionRef.current = emotion;
        onEmotionChange?.(emotion, confidence);
        
      }

      //  HEAD POSE — nod / shake via landmark movement 
      const nose = detection.landmarks.getNose()[0]; // nose tip point
      headYHistory.current.push(nose.y);
      headYXHistory.current.push(nose.x);
      if (headYHistory.current.length > 6) headYHistory.current.shift();
      if (headYXHistory.current.length > 6) headYXHistory.current.shift();

      let headPose: HeadPose = 'still';
      if (headYHistory.current.length >= 4) {
        const yRange = Math.max(...headYHistory.current) - Math.min(...headYHistory.current);
        const xRange = Math.max(...headYXHistory.current) - Math.min(...headYXHistory.current);
        if (yRange > 8)  headPose = 'nodding';  // vertical movement = nod
        if (xRange > 10) headPose = 'shaking';  // horizontal movement = shake
      }

      setResult({ presence, emotion, headPose, confidence });

    } catch (err) {
      // silent — detection errors are common (blur, lighting) and non-fatal
      console.warn('face detection frame error:', err);
    }
  }, [videoRef, onPresenceChange, onEmotionChange]);

  // start detection loop when models are loaded
  useEffect(() => {
    if (!modelsLoaded) return;
    timerRef.current = setInterval(detect, intervalMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [modelsLoaded, detect, intervalMs]);

  // load models on mount (client only)
  useEffect(() => {
    loadModels();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loadModels]);

  return { result, modelsLoaded, error };
}