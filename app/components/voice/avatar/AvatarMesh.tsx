'use client';
import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { AgentState } from '../types';
import { useMorphTargets } from './useMorphTargets';
import { useSpeakingAnimation } from './useSpeakingAnimation';

const AVATAR_URL = './agent_men.glb';

interface Props {
  state: AgentState;
  audioElementRef?: React.RefObject<HTMLAudioElement | null>;
  getAmplitude?: () => number;
}

export default function AvatarMesh({ state , getAmplitude}: Props) {
  const { scene } = useGLTF(AVATAR_URL);
  const hasLogged = useRef(false);

  const blinkTimer = useRef(0);
  const blinkState = useRef(0);
  const headRotX   = useRef(0);
  const headRotY   = useRef(0);

  const morphMeshes = useMemo(() => {
    const found: THREE.SkinnedMesh[] = [];
    scene.traverse((obj) => {
      const m = obj as THREE.SkinnedMesh;
      if (m.isMesh && m.morphTargetDictionary) found.push(m);
    });
    return found;
  }, [scene]);

  const { setMorph, findBone } = useMorphTargets(scene, morphMeshes);
  const { runFrame } = useSpeakingAnimation();

  useEffect(() => {
    if (hasLogged.current) return;
    hasLogged.current = true;
    const bones: string[] = [];
    const morphs: string[] = [];
    scene.traverse((obj) => {
      if ((obj as THREE.Bone).isBone) bones.push(obj.name);
      const m = obj as THREE.SkinnedMesh;
      if (m.isMesh && m.morphTargetDictionary) morphs.push(...Object.keys(m.morphTargetDictionary));
    });
    
  }, [scene]);

  useFrame((three, delta) => {
    const t = three.clock.elapsedTime;

    scene.position.y = -1.9 + Math.sin(t * 2.2) * 0.006;

    const leftArm   = findBone(['LeftArm',   'leftarm',   'Left_Arm',   'mixamorigLeftArm']);
    const rightArm  = findBone(['RightArm',  'rightarm',  'Right_Arm',  'mixamorigRightArm']);
    const leftFore  = findBone(['LeftForeArm',  'leftforearm',  'Left_ForeArm',  'mixamorigLeftForeArm']);
    const rightFore = findBone(['RightForeArm', 'rightforearm', 'Right_ForeArm', 'mixamorigRightForeArm']);
    const leftHand  = findBone(['LeftHand',  'lefthand',  'Left_Hand',  'mixamorigLeftHand']);
    const rightHand = findBone(['RightHand', 'righthand', 'Right_Hand', 'mixamorigRightHand']);

    if (state === 'idle' || state === 'thinking' || state === 'recording') {
      if (leftArm)  { leftArm.rotation.x  = THREE.MathUtils.lerp(leftArm.rotation.x,  1.3,  delta * 4); leftArm.rotation.z  = THREE.MathUtils.lerp(leftArm.rotation.z,  0, delta * 4); }
      if (rightArm) { rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, 1.3,  delta * 4); rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, 0, delta * 4); }
      if (leftFore)  leftFore.rotation.x  = THREE.MathUtils.lerp(leftFore.rotation.x,  0.15, delta * 4);
      if (rightFore) rightFore.rotation.x = THREE.MathUtils.lerp(rightFore.rotation.x, 0.15, delta * 4);
      if (leftHand)  leftHand.rotation.x  = THREE.MathUtils.lerp(leftHand.rotation.x,  0.2,  delta * 4);
      if (rightHand) rightHand.rotation.x = THREE.MathUtils.lerp(rightHand.rotation.x, 0.2,  delta * 4);
    }

//     if (state === 'speaking') {
//   const phase = Math.floor(t / 4) % 3;
//   if (leftArm) { leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, 1.0, delta * 3); leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0.1, delta * 3); }
//   if (rightArm) { rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, -1.15, delta * 3); rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, 0.1, delta * 3); }
//   if (phase === 0) { if (leftFore) leftFore.rotation.x = THREE.MathUtils.lerp(leftFore.rotation.x, -0.6, delta * 3); if (rightFore) rightFore.rotation.x = THREE.MathUtils.lerp(rightFore.rotation.x, -0.6, delta * 3); if (leftHand) leftHand.rotation.y = THREE.MathUtils.lerp(leftHand.rotation.y, -0.3, delta * 3); if (rightHand) rightHand.rotation.y = THREE.MathUtils.lerp(rightHand.rotation.y, 0.3, delta * 3); }
//   if (phase === 1) { if (leftFore) leftFore.rotation.x = THREE.MathUtils.lerp(leftFore.rotation.x, -0.5 + Math.sin(t * 2) * 0.08, delta * 4); if (rightFore) rightFore.rotation.x = THREE.MathUtils.lerp(rightFore.rotation.x, -0.2, delta * 3); if (leftHand) leftHand.rotation.y = THREE.MathUtils.lerp(leftHand.rotation.y, 0, delta * 3); if (rightHand) rightHand.rotation.y = THREE.MathUtils.lerp(rightHand.rotation.y, 0, delta * 3); }
//   if (phase === 2) { if (leftFore) leftFore.rotation.x = THREE.MathUtils.lerp(leftFore.rotation.x, -0.4 + Math.sin(t * 1.5) * 0.05, delta * 3); if (rightFore) rightFore.rotation.x = THREE.MathUtils.lerp(rightFore.rotation.x, -0.4 + Math.sin(t * 1.5 + 2) * 0.05, delta * 3); if (leftHand) leftHand.rotation.x = THREE.MathUtils.lerp(leftHand.rotation.x, Math.sin(t * 3) * 0.1, delta * 5); if (rightHand) rightHand.rotation.x = THREE.MathUtils.lerp(rightHand.rotation.x, Math.sin(t * 3) * 0.1, delta * 5); }
// }

    // Blink
    blinkTimer.current += delta;
    const blinkAt = 3.5;
    if (blinkTimer.current > blinkAt && blinkState.current === 0) blinkState.current = 1;
    if (blinkState.current === 1) {
      const v = Math.min((blinkTimer.current - blinkAt) / 0.055, 1);
      setMorph('eyeBlinkLeft', v); setMorph('eyeBlinkRight', v);
      if (v >= 1) blinkState.current = 2;
    }
    if (blinkState.current === 2) {
      const v = Math.max(1 - (blinkTimer.current - blinkAt - 0.055) / 0.08, 0);
      setMorph('eyeBlinkLeft', v); setMorph('eyeBlinkRight', v);
      if (v <= 0) { blinkState.current = 0; blinkTimer.current = 0; }
    }

    if (state === 'idle') {
      setMorph('mouthSmile', 0.12); setMorph('mouthOpen', 0);
      setMorph('browDownLeft', 0);  setMorph('browDownRight', 0);
      setMorph('mouthFunnel', 0);   setMorph('mouthPucker', 0);
      setMorph('mouthClose', 0);    setMorph('mouthLeft', 0);   setMorph('mouthRight', 0);
      setMorph('cheekSquintLeft', 0); setMorph('cheekSquintRight', 0);
      setMorph('mouthDimpleLeft', 0); setMorph('mouthDimpleRight', 0);
      headRotX.current = THREE.MathUtils.lerp(headRotX.current, 0, delta * 2);
      headRotY.current = THREE.MathUtils.lerp(headRotY.current, 0, delta * 2);
    }
    if (state === 'recording') {
      setMorph('mouthSmile', 0.2); setMorph('browInnerUp', 0.25); setMorph('mouthOpen', 0);
      headRotX.current = THREE.MathUtils.lerp(headRotX.current, Math.sin(t * 1.2) * 0.03, delta * 3);
      headRotY.current = THREE.MathUtils.lerp(headRotY.current, 0, delta * 3);
    }
    if (state === 'thinking') {
      setMorph('mouthSmile', 0); setMorph('browDownLeft', 0.28); setMorph('browDownRight', 0.28); setMorph('mouthOpen', 0);
      headRotX.current = THREE.MathUtils.lerp(headRotX.current, -0.14, delta * 1.5);
      headRotY.current = THREE.MathUtils.lerp(headRotY.current,  0.18, delta * 1.5);
    }
    if (state === 'speaking') {
      runFrame(t, delta, setMorph, headRotX, headRotY);
    }

    scene.rotation.x = headRotX.current;
    scene.rotation.y = headRotY.current;
  });

  return <primitive object={scene} scale={2} position={[0, 20, 3]} />;
}

useGLTF.preload(AVATAR_URL);