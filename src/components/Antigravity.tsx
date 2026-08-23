/* eslint-disable react/no-unknown-property */
/**
 * Antigravity — full-page fixed cursor particle effect
 *
 * KEY FIX vs original:
 *  - Uses window mousemove to track the real cursor instead of
 *    useThree().pointer, which only fires when the mouse is over
 *    the canvas element. Because the canvas is pointer-events:none
 *    it never received pointer events — that was the "no response" bug.
 *  - smoothFactor bumped 0.05→0.18, lerpSpeed 0.05→0.10 for snap.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

export interface AntigravityProps {
  count?: number;
  magnetRadius?: number;
  ringRadius?: number;
  waveSpeed?: number;
  waveAmplitude?: number;
  particleSize?: number;
  lerpSpeed?: number;
  color?: string;
  autoAnimate?: boolean;
  particleVariance?: number;
  rotationSpeed?: number;
  depthFactor?: number;
  pulseSpeed?: number;
  particleShape?: 'capsule' | 'sphere' | 'box' | 'tetrahedron';
  fieldStrength?: number;
}

// ── Inner scene ────────────────────────────────────────────────────────────────
const AntigravityInner = ({
  count = 700,
  magnetRadius = 6,
  ringRadius = 7,
  waveSpeed = 0.4,
  waveAmplitude = 1,
  particleSize = 1.5,
  lerpSpeed = 0.10,
  color = '#1F4FD8',
  autoAnimate = true,
  particleVariance = 1,
  rotationSpeed = 0,
  depthFactor = 1,
  pulseSpeed = 3,
  particleShape = 'capsule',
  fieldStrength = 10,
}: AntigravityProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { viewport, size } = useThree();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Raw mouse in px from window — works even with pointer-events:none canvas
  const rawMouse = useRef({ x: 0, y: 0 });
  const lastMouseMoveTime = useRef(0);
  const virtualMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      rawMouse.current = { x: e.clientX, y: e.clientY };
      lastMouseMoveTime.current = Date.now();
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const particles = useMemo(() => {
    const temp: any[] = [];
    const w = viewport.width || 100;
    const h = viewport.height || 100;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * w;
      const y = (Math.random() - 0.5) * h;
      const z = (Math.random() - 0.5) * 20;
      temp.push({
        t: Math.random() * 100,
        speed: 0.01 + Math.random() / 200,
        mx: x, my: y, mz: z,
        cx: x, cy: y, cz: z,
        randomRadiusOffset: (Math.random() - 0.5) * 2,
      });
    }
    return temp;
  }, [count, viewport.width, viewport.height]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { viewport: v } = state;

    // Convert window px → Three.js world units
    // canvas fills 100vw × 100vh, camera at z=50, fov=35
    const halfW = size.width / 2;
    const halfH = size.height / 2;
    const ndcX = (rawMouse.current.x - halfW) / halfW;   // -1 … 1
    const ndcY = -(rawMouse.current.y - halfH) / halfH;  // -1 … 1 (flip Y)

    let destX = ndcX * (v.width / 2);
    let destY = ndcY * (v.height / 2);

    if (autoAnimate && Date.now() - lastMouseMoveTime.current > 2000) {
      const t = state.clock.getElapsedTime();
      destX = Math.sin(t * 0.5) * (v.width / 4);
      destY = Math.cos(t * 0.5 * 2) * (v.height / 4);
    }

    // Smooth virtual cursor — 0.18 was 0.05, much faster
    const smooth = 0.18;
    virtualMouse.current.x += (destX - virtualMouse.current.x) * smooth;
    virtualMouse.current.y += (destY - virtualMouse.current.y) * smooth;

    const tx = virtualMouse.current.x;
    const ty = virtualMouse.current.y;
    const globalRot = state.clock.getElapsedTime() * rotationSpeed;

    particles.forEach((p, i) => {
      p.t += p.speed / 2;
      const t = p.t;

      const proj = 1 - p.cz / 50;
      const ptx = tx * proj;
      const pty = ty * proj;

      const dx = p.mx - ptx;
      const dy = p.my - pty;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let tpx = p.mx, tpy = p.my, tpz = p.mz * depthFactor;

      if (dist < magnetRadius) {
        const angle = Math.atan2(dy, dx) + globalRot;
        const wave = Math.sin(t * waveSpeed + angle) * 0.5 * waveAmplitude;
        const dev = p.randomRadiusOffset * (5 / (fieldStrength + 0.1));
        const r = ringRadius + wave + dev;
        tpx = ptx + r * Math.cos(angle);
        tpy = pty + r * Math.sin(angle);
        tpz = p.mz * depthFactor + Math.sin(t) * waveAmplitude * depthFactor;
      }

      p.cx += (tpx - p.cx) * lerpSpeed;
      p.cy += (tpy - p.cy) * lerpSpeed;
      p.cz += (tpz - p.cz) * lerpSpeed;

      dummy.position.set(p.cx, p.cy, p.cz);
      dummy.lookAt(ptx, pty, p.cz);
      dummy.rotateX(Math.PI / 2);

      const d2 = Math.sqrt((p.cx - ptx) ** 2 + (p.cy - pty) ** 2);
      const sc = Math.max(0, Math.min(1, 1 - Math.abs(d2 - ringRadius) / 10));
      const fs = sc * (0.8 + Math.sin(t * pulseSpeed) * 0.2 * particleVariance) * particleSize;
      dummy.scale.setScalar(fs);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      {particleShape === 'capsule'     && <capsuleGeometry args={[0.1, 0.4, 4, 8]} />}
      {particleShape === 'sphere'      && <sphereGeometry args={[0.2, 16, 16]} />}
      {particleShape === 'box'         && <boxGeometry args={[0.3, 0.3, 0.3]} />}
      {particleShape === 'tetrahedron' && <tetrahedronGeometry args={[0.3]} />}
      <meshBasicMaterial color={color as any} />
    </instancedMesh>
  );
};

// ── Full-page fixed wrapper ────────────────────────────────────────────────────
const Antigravity = (props: AntigravityProps) => (
  <Canvas
    style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 0 }}
    camera={{ position: [0, 0, 50], fov: 35 }}
    dpr={[1, 1.5]}           // cap pixel ratio for perf
    frameloop="always"
  >
    <AntigravityInner {...props} />
  </Canvas>
);

export default Antigravity;
