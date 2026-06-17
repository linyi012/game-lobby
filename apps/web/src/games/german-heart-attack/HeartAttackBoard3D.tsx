import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, RoundedBox } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  cardLabel,
  type HeartAttackCard,
  type HeartAttackGameState,
} from '@game-lobby/game-engine';

const faceTextureCache = new Map<string, THREE.CanvasTexture>();
const decalTextureCache = new Map<string, THREE.CanvasTexture>();

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function getCardTexture(card: HeartAttackCard): THREE.CanvasTexture {
  const label = cardLabel(card);
  const key = label;
  const cached = faceTextureCache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const bg =
    card.kind === 'bomb' ? '#7f1d1d' : card.kind === 'wild' ? '#4c1d95' : card.kind === 'double' ? '#854d0e' : '#fef3c7';
  ctx.fillStyle = bg;
  roundedRect(ctx, 6, 6, size - 12, size - 12, 28);
  ctx.fill();

  ctx.fillStyle = card.kind === 'bomb' ? '#fecaca' : '#1a1206';
  ctx.font = "800 72px 'Segoe UI Emoji', system-ui, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = label.split(' ');
  if (lines.length > 1) {
    ctx.font = "800 56px 'Segoe UI Emoji', system-ui, sans-serif";
    ctx.fillText(lines[0]!, size / 2, size / 2 - 20);
    ctx.font = "700 40px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(lines.slice(1).join(' '), size / 2, size / 2 + 36);
  } else {
    ctx.fillText(label, size / 2, size / 2 + 6);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  faceTextureCache.set(key, texture);
  return texture;
}

function getDecalTexture(text: string): THREE.CanvasTexture {
  const key = `decal|${text}`;
  const cached = decalTextureCache.get(key);
  if (cached) return cached;

  const w = 512;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  roundedRect(ctx, 8, 8, w - 16, h - 16, 22);
  ctx.fillStyle = 'rgba(12, 22, 38, 0.72)';
  ctx.fill();
  ctx.fillStyle = 'rgba(148, 163, 184, 0.92)';
  ctx.font = "600 72px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  decalTextureCache.set(key, texture);
  return texture;
}

const TILE_W = 0.66;
const TILE_H = 0.98;
const TILE_D = 0.15;
const CIRCLE_RADIUS = 4.1;
const TWO_PLAYER_HALF_GAP = 2.35;
const PLAYFIELD_LIFT_2P = 0.62;
const PLAYFIELD_LIFT_MP = 0.28;
const HTML_Z: [number, number] = [3, 0];

function seatLayout(playerCount: number, seatIndex: number) {
  if (playerCount === 2) {
    const z = seatIndex === 0 ? TWO_PLAYER_HALF_GAP : -TWO_PLAYER_HALF_GAP;
    return { x: 0, z, rotateY: seatIndex === 0 ? 0 : Math.PI };
  }
  const angle = (2 * Math.PI * seatIndex) / playerCount;
  return {
    x: CIRCLE_RADIUS * Math.sin(angle),
    z: CIRCLE_RADIUS * Math.cos(angle),
    rotateY: angle,
  };
}

interface Props {
  state: HeartAttackGameState;
  myMemberId: string | null;
  bellActive: boolean;
}

function Card3D({ card, y = 0.12 }: { card: HeartAttackCard; y?: number }) {
  const texture = useMemo(() => getCardTexture(card), [card]);
  return (
    <RoundedBox args={[TILE_W, TILE_H, TILE_D]} radius={0.07} smoothness={4} position={[0, y, 0]} castShadow>
      <meshStandardMaterial map={texture} roughness={0.55} metalness={0.05} />
    </RoundedBox>
  );
}

function PlayerStack({
  handCount,
  label,
  isCurrent,
  isWinner,
}: {
  handCount: number;
  label: string;
  isCurrent: boolean;
  isWinner: boolean;
}) {
  const layers = Math.min(Math.max(handCount, 1), 12);
  return (
    <group>
      {Array.from({ length: layers }, (_, i) => (
        <RoundedBox
          key={i}
          args={[TILE_W * 0.88, 0.04, TILE_H * 0.88]}
          radius={0.04}
          position={[0, i * 0.045 + 0.04, 0]}
        >
          <meshStandardMaterial color="#1a2740" roughness={0.9} />
        </RoundedBox>
      ))}
      <Html center zIndexRange={HTML_Z} position={[0, 1.5, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            whiteSpace: 'nowrap',
            padding: '3px 12px',
            borderRadius: 999,
            fontSize: '13px',
            fontWeight: 700,
            color: isWinner ? '#1a1206' : '#e8edf5',
            background: isWinner
              ? 'linear-gradient(180deg, #fbbf24, #f59e0b)'
              : isCurrent
                ? 'rgba(37,99,235,0.85)'
                : 'rgba(20,28,40,0.8)',
            border: isCurrent ? '1px solid #5b8def' : '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {label} ({handCount})
        </div>
      </Html>
    </group>
  );
}

function Bell({ active }: { active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    const m = ref.current;
    if (!m) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (active) {
      const pulse = 0.35 + Math.sin(st.clock.elapsedTime * 6) * 0.25;
      mat.emissiveIntensity = pulse;
    } else {
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 0.08, 0.1);
    }
  });
  return (
    <mesh ref={ref} position={[0, 0.35, 0]} castShadow>
      <sphereGeometry args={[0.28, 24, 24]} />
      <meshStandardMaterial
        color="#fbbf24"
        emissive="#f59e0b"
        emissiveIntensity={active ? 0.5 : 0.08}
        metalness={0.6}
        roughness={0.35}
      />
    </mesh>
  );
}

function CenterPile({ pile }: { pile: HeartAttackCard[] }) {
  if (pile.length === 0) return null;
  const top = pile[pile.length - 1]!;
  return (
    <group>
      {pile.slice(-3).map((card, i) => (
        <group key={i} position={[Math.sin(i) * 0.02, i * 0.04, Math.cos(i) * 0.02]}>
          <Card3D card={card} y={0.08 + i * 0.04} />
        </group>
      ))}
      <Html center zIndexRange={HTML_Z} position={[0, 1.1, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: 8 }}>
          中央 {pile.length} 张 · {cardLabel(top)}
        </div>
      </Html>
    </group>
  );
}

function DiscardPile({ count }: { count: number }) {
  const labelTexture = useMemo(() => getDecalTexture(`弃牌 ${count}`), [count]);
  if (count <= 0) return null;
  return (
    <group position={[1.8, 0.08, 0.6]}>
      <RoundedBox args={[TILE_W * 0.7, 0.04, TILE_H * 0.7]} radius={0.04}>
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </RoundedBox>
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.28]} />
        <meshStandardMaterial map={labelTexture} transparent />
      </mesh>
    </group>
  );
}

function Confetti() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = 120;
  const palette = useMemo(
    () => ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#e879f9'].map((c) => new THREE.Color(c)),
    [],
  );
  const data = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: (Math.random() - 0.5) * 14,
        y: Math.random() * 10 + 3,
        z: (Math.random() - 0.5) * 8,
        vy: 1.2 + Math.random() * 1.5,
        vr: (Math.random() - 0.5) * 4,
        rx: Math.random() * 6,
        rz: Math.random() * 6,
        sway: Math.random() * Math.PI * 2,
        color: palette[Math.floor(Math.random() * palette.length)]!,
      })),
    [palette],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    data.forEach((d, i) => m.setColorAt(i, d.color));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [data]);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const clamped = Math.min(dt, 0.05);
    for (let i = 0; i < data.length; i++) {
      const d = data[i]!;
      d.y -= d.vy * clamped;
      d.sway += clamped;
      d.rx += d.vr * clamped;
      if (d.y < -0.3) d.y = 10;
      dummy.position.set(d.x + Math.sin(d.sway) * 0.4, d.y, d.z);
      dummy.rotation.set(d.rx, 0, d.rz);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, COUNT]}>
      <planeGeometry args={[0.14, 0.22]} />
      <meshStandardMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function Scene({ state, myMemberId, bellActive }: Props) {
  const ordered = useMemo(() => {
    const players = state.players;
    const meIdx = players.findIndex((p) => p.id === myMemberId);
    if (meIdx < 0) return players.map((p, i) => ({ player: p, originalIndex: i }));
    const rest = players.map((p, i) => ({ player: p, originalIndex: i })).filter((_, i) => i !== meIdx);
    return [{ player: players[meIdx]!, originalIndex: meIdx }, ...rest];
  }, [state.players, myMemberId]);

  const n = ordered.length;
  const current = state.players[state.currentPlayerIndex];
  const ended = state.phase === 'ended';
  const hasWinner = ended && state.winnerId != null;
  const tableSize = n <= 2 ? 10 : CIRCLE_RADIUS * 2 + 3;
  const playfieldLift = n === 2 ? PLAYFIELD_LIFT_2P : PLAYFIELD_LIFT_MP;

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 12, 8]} intensity={1.1} castShadow />
      <directionalLight position={[-6, 6, -4]} intensity={0.4} color="#9bbcff" />

      <mesh position={[0, -0.1, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0c1422" roughness={0.95} />
      </mesh>

      {n >= 3 ? (
        <mesh position={[0, -0.02, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[tableSize / 2, 48]} />
          <meshStandardMaterial color="#1a3d2e" roughness={0.85} />
        </mesh>
      ) : (
        <RoundedBox args={[6, 0.2, tableSize]} radius={0.2} position={[0, -0.02, 0]} receiveShadow>
          <meshStandardMaterial color="#1a3d2e" roughness={0.85} />
        </RoundedBox>
      )}

      <group position={[0, playfieldLift, 0]}>
        <CenterPile pile={state.centerPile} />
        <Bell active={bellActive} />
        <DiscardPile count={state.discardCount} />

        {ordered.map(({ player }, seatIndex) => {
          const { x, z, rotateY } = seatLayout(n, seatIndex);
          const isCurrent = current?.id === player.id;
          const isWinner = state.winnerId === player.id;
          const label = player.id === myMemberId ? `${player.name}（你）` : player.name;
          return (
            <group key={player.id} position={[x, 0, z]} rotation={[0, rotateY, 0]}>
              <PlayerStack
                handCount={player.handCount}
                label={label}
                isCurrent={isCurrent && state.phase === 'playing'}
                isWinner={isWinner}
              />
            </group>
          );
        })}
      </group>

      {hasWinner && <Confetti />}
    </>
  );
}

export function HeartAttackBoard3D(props: Props) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 7.5, 8.2], fov: 42, near: 0.1, far: 100 }}
      style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top, #16243f 0%, #0a0f18 70%)' }}
    >
      <Scene {...props} />
      <OrbitControls
        enablePan={false}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={16}
        target={[0, 0.3, 0]}
        enableDamping
        dampingFactor={0.06}
      />
    </Canvas>
  );
}
