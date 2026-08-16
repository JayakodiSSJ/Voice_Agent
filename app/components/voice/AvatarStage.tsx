'use client';
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import { AgentState } from './types';
import AvatarMesh from './avatar/AvatarMesh';
import { StatusLabel, SoundWaves } from './avatar/AvatarHUD';

interface Props {
  state:             AgentState;
  statusMsg:         string;
  audioElementRef?:  React.RefObject<HTMLAudioElement | null>;
  theme?:            'dark' | 'light';
  getAmplitude?:     () => number;  
}

export default function AvatarStage({ state, statusMsg, theme = 'dark', getAmplitude }: Props) {
  const bg = theme === 'light'
    ? 'linear-gradient(180deg,#f0f4f8 0%,#e8eef5 60%,#f0f4f8 100%)'
    : 'linear-gradient(180deg,#060B15 0%,#08111f 60%,#060B15 100%)';

  const glowColor =
    state === 'speaking'  ? `rgba(0,166,81,${theme === 'light' ? '0.15' : '0.12'})` :
    state === 'recording' ? `rgba(239,68,68,${theme === 'light' ? '0.15' : '0.12'})` :
    state === 'thinking'  ? `rgba(0,112,184,${theme === 'light' ? '0.15' : '0.12'})` :
    theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)';

  return (
    <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center overflow-hidden" style={{ background: bg }}>
      <div className="w-full h-full relative flex-1">

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 sm:w-96 sm:h-96 rounded-full blur-[100px] transition-all duration-1000" style={{ backgroundColor: glowColor }} />
        </div>

        <Canvas camera={{ position: [0, 1.8, 4.2], fov: 45 }} gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent', width: '100%', height: '100%' }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[1, 2, 2]} intensity={1.2} />
          <directionalLight position={[-1, 0, 1]} intensity={0.4} color="#4488ff" />
          <directionalLight position={[0, -1, 0]} intensity={0.2} color="#ff8844" />
          <Environment preset="city" />
          <Suspense fallback={null}>
            <AvatarMesh state={state} getAmplitude={getAmplitude} />
            <ContactShadows position={[0, -1.6, 0]} opacity={0.3} scale={1} blur={1} />
          </Suspense>
        </Canvas>
      </div>

      <div className="absolute bottom-8 left-0 right-0 z-10 flex flex-col items-center pointer-events-none">
        <SoundWaves state={state} />
        <StatusLabel state={state} msg={statusMsg} theme={theme} />
      </div>
    </div>
  );
}