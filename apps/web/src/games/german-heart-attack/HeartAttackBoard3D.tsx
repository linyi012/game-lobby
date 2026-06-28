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

const TILE_W = 0.66;
const TILE_H = 0.98;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Flat card face aspect (width : length), no thickness — art anchored at texture (0,0). */
const CARD_ASPECT = TILE_W / TILE_H;
const CARD_ART_SCALE = 0.65;

function getCardTexture(card: HeartAttackCard): THREE.CanvasTexture {
  const label = cardLabel(card);
  const key = `flat-tl-v3|${label}`;
  const cached = faceTextureCache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const artW = Math.round(size * CARD_ASPECT);
  const artH = size;
  const cornerR = Math.max(4, Math.round(artW * 0.08));

  ctx.save();
  ctx.scale(CARD_ART_SCALE, CARD_ART_SCALE);

  const bg =
    card.kind === 'bomb' ? '#7f1d1d' : card.kind === 'wild' ? '#4c1d95' : card.kind === 'double' ? '#854d0e' : '#fef3c7';
  ctx.fillStyle = bg;
  roundedRect(ctx, 0, 0, artW, artH, cornerR);
  ctx.fill();

  ctx.fillStyle = card.kind === 'bomb' ? '#fecaca' : '#1a1206';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = artW / 2;
  const cy = artH / 2;
  const lines = label.split(' ');
  if (lines.length > 1) {
    ctx.font = `800 ${Math.round(artH * 0.26)}px 'Segoe UI Emoji', system-ui, sans-serif`;
    ctx.fillText(lines[0]!, cx, cy - artH * 0.1);
    ctx.font = `700 ${Math.round(artH * 0.17)}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillText(lines.slice(1).join(' '), cx, cy + artH * 0.14);
  } else {
    ctx.font = `800 ${Math.round(artH * 0.34)}px 'Segoe UI Emoji', system-ui, sans-serif`;
    ctx.fillText(label, cx, cy);
  }
  ctx.restore();

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

const CIRCLE_RADIUS = 4.1;
const TWO_PLAYER_HALF_GAP = 2.35;
const PLAYFIELD_LIFT_2P = 0.62;
const PLAYFIELD_LIFT_MP = 0.28;
const FLIP_ZONE_Z = -1.18;
const HTML_Z: [number, number] = [3, 0];

/** Infer which player flipped a card based on turn order (pile is shared logically). */
function inferFlipperIndex(
  cardIndexInPile: number,
  pileLength: number,
  currentPlayerIndex: number,
  playerCount: number,
): number {
  return (currentPlayerIndex - pileLength + cardIndexInPile + playerCount * 1000) % playerCount;
}

function groupPileByPlayer(
  pile: HeartAttackCard[],
  currentPlayerIndex: number,
  playerCount: number,
): Map<number, HeartAttackCard[]> {
  const map = new Map<number, HeartAttackCard[]>();
  for (let i = 0; i < pile.length; i++) {
    const pi = inferFlipperIndex(i, pile.length, currentPlayerIndex, playerCount);
    const list = map.get(pi) ?? [];
    list.push(pile[i]!);
    map.set(pi, list);
  }
  return map;
}

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
  slapAnimations?: SlapAnimation[];
  bellSlapPulse?: number;
}

export interface SlapAnimation {
  id: string;
  playerId: string;
  startTime: number;
  overlapIndex: number;
}

function FlatCard3D({ card, stackIndex = 0 }: { card: HeartAttackCard; stackIndex?: number }) {
  const texture = useMemo(() => getCardTexture(card), [card]);
  const y = stackIndex * 0.045 + 0.024;
  return (
    <RoundedBox
      args={[TILE_W * 0.92, 0.045, TILE_H * 0.92]}
      radius={0.04}
      smoothness={2}
      position={[
        Math.sin(stackIndex * 1.7) * 0.012,
        y,
        Math.cos(stackIndex * 2.3) * 0.012,
      ]}
      rotation={[0, stackIndex * 0.06, 0]}
      castShadow
    >
      <meshStandardMaterial map={texture} color="#ffffff" roughness={0.55} metalness={0.05} />
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

function Bell({ active, slapPulse = 0 }: { active: boolean; slapPulse?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const shakeRef = useRef(0);
  const bellProfile = useMemo(
    () => [
      new THREE.Vector2(0.055, 0),
      new THREE.Vector2(0.22, 0),
      new THREE.Vector2(0.24, 0.025),
      new THREE.Vector2(0.21, 0.1),
      new THREE.Vector2(0.13, 0.19),
      new THREE.Vector2(0.07, 0.24),
      new THREE.Vector2(0.045, 0.27),
    ],
    [],
  );

  useEffect(() => {
    if (slapPulse > 0) shakeRef.current = 1;
  }, [slapPulse]);

  useFrame((st, dt) => {
    const m = bodyRef.current;
    const g = groupRef.current;
    if (m) {
      const mat = m.material as THREE.MeshStandardMaterial;
      const target = active ? 0.4 + Math.sin(st.clock.elapsedTime * 6) * 0.28 : 0.06;
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, target, active ? 0.14 : 0.1);
    }
    if (g && shakeRef.current > 0) {
      shakeRef.current = Math.max(0, shakeRef.current - dt * 3.2);
      const s = shakeRef.current;
      g.rotation.z = Math.sin(st.clock.elapsedTime * 48) * 0.12 * s;
      g.position.y = 0.04 + s * 0.04;
    } else if (g) {
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, 0, 0.15);
      g.position.y = THREE.MathUtils.lerp(g.position.y, 0.04, 0.15);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.04, 0]}>
      <mesh position={[0, 0.018, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.34, 0.38, 0.036, 32]} />
        <meshStandardMaterial color="#2a1810" roughness={0.85} metalness={0.15} />
      </mesh>

      <mesh ref={bodyRef} position={[0, 0.16, 0]} castShadow>
        <latheGeometry args={[bellProfile, 32]} />
        <meshStandardMaterial
          color="#d4a017"
          emissive="#f59e0b"
          emissiveIntensity={active ? 0.45 : 0.06}
          metalness={0.88}
          roughness={0.22}
        />
      </mesh>

      <mesh position={[0, 0.31, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.04, 0.05, 16]} />
        <meshStandardMaterial color="#b8860b" metalness={0.9} roughness={0.18} />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#c9a227" metalness={0.92} roughness={0.15} />
      </mesh>

      <mesh position={[0, 0.1, 0.04]} castShadow>
        <sphereGeometry args={[0.05, 14, 14]} />
        <meshStandardMaterial color="#7a6010" metalness={0.75} roughness={0.35} />
      </mesh>
    </group>
  );
}

function SlapHand({
  seatX,
  seatZ,
  startTime,
  overlapIndex,
}: {
  seatX: number;
  seatZ: number;
  startTime: number;
  overlapIndex: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const skin = '#e8b896';
  const sleeve = '#334155';

  useEffect(() => {
    const g = ref.current;
    if (g) g.visible = true;
  }, [startTime]);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const elapsed = (Date.now() - startTime) / 1000;
    const reach = 0.2;
    const hold = 0.12;
    const retract = 0.32;
    const total = reach + hold + retract;

    if (elapsed >= total) {
      g.visible = false;
      return;
    }

    const startX = seatX * 0.62;
    const startZ = seatZ * 0.62;
    const overlapX = (overlapIndex % 3 - 1) * 0.09;
    const overlapZ = Math.floor(overlapIndex / 3) * 0.07 - 0.02;
    const endX = overlapX;
    const endZ = overlapZ;

    let progress = 0;
    if (elapsed < reach) {
      const t = elapsed / reach;
      progress = 1 - Math.pow(1 - t, 2.8);
    } else if (elapsed < reach + hold) {
      progress = 1;
    } else {
      const t = (elapsed - reach - hold) / retract;
      progress = 1 - t * t;
    }

    g.position.x = startX + (endX - startX) * progress;
    g.position.z = startZ + (endZ - startZ) * progress;
    g.position.y = 0.1 + Math.sin(progress * Math.PI) * 0.22;

    // Fingers extend toward local -Z; point them at table center from the seat.
    g.rotation.y = Math.atan2(seatX, seatZ);
    g.rotation.x = THREE.MathUtils.lerp(0.25, 0.72, progress);
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 0.05, 0.22]} castShadow>
        <boxGeometry args={[0.12, 0.1, 0.34]} />
        <meshStandardMaterial color={sleeve} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.06, 0.02]} castShadow>
        <boxGeometry args={[0.17, 0.06, 0.15]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      {[-0.06, -0.02, 0.02, 0.06].map((x, i) => (
        <mesh key={i} position={[x, 0.075, -0.07 - i * 0.012]} castShadow>
          <boxGeometry args={[0.028, 0.04, 0.07]} />
          <meshStandardMaterial color={skin} roughness={0.72} />
        </mesh>
      ))}
    </group>
  );
}

function SlapHandsLayer({
  animations,
  seatByPlayerId,
}: {
  animations: SlapAnimation[];
  seatByPlayerId: Map<string, { x: number; z: number }>;
}) {
  if (animations.length === 0) return null;
  return (
    <group>
      {animations.map((anim) => {
        const seat = seatByPlayerId.get(anim.playerId);
        if (!seat) return null;
        return (
          <SlapHand
            key={anim.id}
            seatX={seat.x}
            seatZ={seat.z}
            startTime={anim.startTime}
            overlapIndex={anim.overlapIndex}
          />
        );
      })}
    </group>
  );
}

function PlayerFlipPile({ cards }: { cards: HeartAttackCard[] }) {
  if (cards.length === 0) return null;
  const top = cards[cards.length - 1]!;
  const visible = cards.slice(-3);
  const base = cards.length - visible.length;
  return (
    <group position={[0, 0, FLIP_ZONE_Z]}>
      {visible.map((card, i) => (
        <FlatCard3D key={`${base + i}-${cardLabel(card)}`} card={card} stackIndex={i} />
      ))}
      <Html center zIndexRange={HTML_Z} position={[0, 0.38, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            fontSize: '10px',
            color: '#94a3b8',
            background: 'rgba(0,0,0,0.55)',
            padding: '2px 7px',
            borderRadius: 8,
            whiteSpace: 'nowrap',
          }}
        >
          {cards.length} 张 · {cardLabel(top)}
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

function Scene({ state, myMemberId, bellActive, slapAnimations = [], bellSlapPulse = 0 }: Props) {
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

  const pileByPlayer = useMemo(
    () => groupPileByPlayer(state.centerPile, state.currentPlayerIndex, state.players.length),
    [state.centerPile, state.currentPlayerIndex, state.players.length],
  );

  const pendingWildIdx =
    state.stage === 'choosing_fruit' && state.wildFlipperId
      ? state.players.findIndex((p) => p.id === state.wildFlipperId)
      : -1;

  const seatByPlayerId = useMemo(() => {
    const map = new Map<string, { x: number; z: number }>();
    ordered.forEach(({ player }, seatIndex) => {
      const { x, z } = seatLayout(n, seatIndex);
      map.set(player.id, { x, z });
    });
    return map;
  }, [ordered, n]);

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
        <Bell active={bellActive} slapPulse={bellSlapPulse} />
        <SlapHandsLayer animations={slapAnimations} seatByPlayerId={seatByPlayerId} />
        <DiscardPile count={state.discardCount} />

        {ordered.map(({ player, originalIndex }, seatIndex) => {
          const { x, z, rotateY } = seatLayout(n, seatIndex);
          const isCurrent = current?.id === player.id;
          const isWinner = state.winnerId === player.id;
          const label = player.id === myMemberId ? `${player.name}（你）` : player.name;
          const flipCards = [...(pileByPlayer.get(originalIndex) ?? [])];
          if (pendingWildIdx === originalIndex && state.pendingWild) {
            flipCards.push(state.pendingWild);
          }
          return (
            <group key={player.id} position={[x, 0, z]} rotation={[0, rotateY, 0]}>
              <PlayerStack
                handCount={player.handCount}
                label={label}
                isCurrent={isCurrent && state.phase === 'playing'}
                isWinner={isWinner}
              />
              <PlayerFlipPile cards={flipCards} />
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
