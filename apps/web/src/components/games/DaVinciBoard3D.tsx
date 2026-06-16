import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, RoundedBox } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { DaVinciGameState, DaVinciTile } from '../../types/game';

type EndState = 'none' | 'winner' | 'loser';

// The whole tile face (background + number) is baked onto a single high-res
// canvas texture. Rendering it as an OPAQUE sticker (no transparency, with a
// polygon offset) avoids the transparency depth-sorting that made freshly added
// tiles flicker as the camera micro-moved, while staying crisp at any zoom.
const faceTextureCache = new Map<string, THREE.CanvasTexture>();

function getFaceTexture(label: string, bg: string, text: string): THREE.CanvasTexture {
  const key = `${label}|${bg}|${text}`;
  const cached = faceTextureCache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  // Background fills the face so the sticker is fully opaque.
  ctx.fillStyle = bg;
  roundedRect(ctx, 6, 6, size - 12, size - 12, 28);
  ctx.fill();

  ctx.fillStyle = text;
  ctx.font = "800 168px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, size / 2, size / 2 + 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  faceTextureCache.set(key, texture);
  return texture;
}

interface Props {
  state: DaVinciGameState;
  myMemberId: string | null;
  isMyTurn: boolean;
  selected: { targetId: string; tileIndex: number } | null;
  onSelectTile: (targetId: string, tileIndex: number) => void;
}

const TILE_W = 0.66;
const TILE_H = 0.98;
const TILE_D = 0.15;
const GAP = 0.14;
const ROW_GAP = 2.05;
const ROW_TILT = -0.32;

function tileFaces(tile: DaVinciTile) {
  if (tile.color === 'white') {
    return { body: '#e9edf4', text: '#0f172a', sub: '#475569' };
  }
  return { body: '#171f2c', text: '#f1f5f9', sub: '#94a3b8' };
}

function tileLabel(tile: DaVinciTile): string {
  if (tile.isJoker) return '-';
  return tile.value >= 0 ? String(tile.value) : '?';
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface Tile3DProps {
  tile: DaVinciTile;
  x: number;
  selectable: boolean;
  selected: boolean;
  onClick: () => void;
  endState: EndState;
}

function Tile3D({ tile, x, selectable, selected, onClick, endState }: Tile3DProps) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const seed = useMemo(() => Math.random() * Math.PI * 2, []);
  const faces = tileFaces(tile);
  const label = tileLabel(tile);
  const lift = selected ? 0.4 : hovered && selectable ? 0.22 : 0;
  const frameColor = selected ? '#5b8def' : tile.revealed ? '#fbbf24' : null;
  const faceTexture = useMemo(() => getFaceTexture(label, faces.body, faces.text), [label, faces.body, faces.text]);

  const isWinner = endState === 'winner';
  const isLoser = endState === 'loser';

  useFrame((st, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const clamped = Math.min(dt, 0.05);
    if (isWinner) {
      // Bob up and gently sway, keeping the number facing the camera.
      const t = st.clock.elapsedTime;
      g.position.y = TILE_H / 2 + 0.28 + Math.sin(t * 3 + x * 2.2 + seed) * 0.16;
      g.rotation.z = Math.sin(t * 2 + seed) * 0.12;
      g.rotation.x = 0;
    } else if (isLoser) {
      // Topple backward and settle flat on the table.
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -1.4, 4, clamped);
      g.rotation.z = THREE.MathUtils.damp(g.rotation.z, 0, 4, clamped);
      g.position.y = THREE.MathUtils.damp(g.position.y, 0.18, 4, clamped);
    }
  });

  return (
    <group ref={groupRef} position={[x, TILE_H / 2 + lift, 0]}>
      {frameColor && (
        <RoundedBox args={[TILE_W + 0.12, TILE_H + 0.12, TILE_D + 0.02]} radius={0.08} smoothness={3} position={[0, 0, -0.01]}>
          <meshStandardMaterial color={frameColor} emissive={frameColor} emissiveIntensity={0.6} roughness={0.4} />
        </RoundedBox>
      )}
      <RoundedBox
        args={[TILE_W, TILE_H, TILE_D]}
        radius={0.07}
        smoothness={4}
        castShadow
        onClick={(e) => {
          if (!selectable) return;
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          if (!selectable) return;
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <meshStandardMaterial
          color={faces.body}
          emissive={isWinner ? '#f59e0b' : '#000000'}
          emissiveIntensity={isWinner ? 0.5 : 0}
          metalness={0.15}
          roughness={0.55}
        />
      </RoundedBox>
      <mesh position={[0, 0, TILE_D / 2 + 0.004]} raycast={() => null}>
        <planeGeometry args={[TILE_W * 0.96, TILE_H * 0.96]} />
        <meshStandardMaterial
          map={faceTexture}
          roughness={0.6}
          metalness={0.1}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
}

interface RackProps {
  z: number;
  rotateY: number;
  player: DaVinciGameState['players'][number];
  isCurrent: boolean;
  selectable: boolean;
  selectedIndex: number | null;
  onSelectTile: (tileIndex: number) => void;
  label: string;
  endState: EndState;
  hideTiles?: boolean;
}

function Rack({ z, rotateY, player, isCurrent, selectable, selectedIndex, onSelectTile, label, endState, hideTiles }: RackProps) {
  const count = player.rack.length;
  const totalW = count > 0 ? count * (TILE_W + GAP) - GAP : 0;
  const isWinner = endState === 'winner';
  const isLoser = endState === 'loser';

  let platformColor = '#15202f';
  let platformEmissive = '#000000';
  let platformGlow = 0;
  if (isWinner) {
    platformColor = '#3a2e0c';
    platformEmissive = '#f59e0b';
    platformGlow = 0.55;
  } else if (isCurrent) {
    platformColor = '#1e3a5f';
    platformEmissive = '#2563eb';
    platformGlow = 0.35;
  }

  return (
    <group position={[0, 0, z]} rotation={[0, rotateY, 0]}>
      {/* seat platform */}
      <RoundedBox
        args={[Math.max(totalW + 0.6, 1.2), 0.12, 1.5]}
        radius={0.06}
        smoothness={3}
        position={[0, 0.02, 0]}
        receiveShadow
      >
        <meshStandardMaterial color={platformColor} emissive={platformEmissive} emissiveIntensity={platformGlow} roughness={0.7} />
      </RoundedBox>

      {isWinner && <pointLight position={[0, 2.4, 0.6]} intensity={6} distance={6} color="#fbbf24" />}

      {!hideTiles && (
        <group rotation={[ROW_TILT, 0, 0]} position={[0, 0.12, 0.1]}>
          {player.rack.map((tile, i) => {
            const x = -totalW / 2 + i * (TILE_W + GAP) + TILE_W / 2;
            return (
              <Tile3D
                key={i}
                tile={tile}
                x={x}
                selectable={selectable && !tile.revealed}
                selected={selectedIndex === i}
                onClick={() => onSelectTile(i)}
                endState={endState}
              />
            );
          })}
        </group>
      )}

      {isWinner && (
        <Html center position={[0, 2.5, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{ fontSize: '40px', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))', animation: 'dv-bob 1.4s ease-in-out infinite' }}>
            👑
          </div>
        </Html>
      )}

      <Html center position={[0, 1.7, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
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
            border: isWinner
              ? '1px solid #fde047'
              : isCurrent
                ? '1px solid #5b8def'
                : '1px solid rgba(255,255,255,0.08)',
            opacity: isLoser ? 0.55 : 1,
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

function Confetti() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = 150;
  const palette = useMemo(
    () => ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#e879f9', '#fde047'].map((c) => new THREE.Color(c)),
    [],
  );
  const data = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: (Math.random() - 0.5) * 16,
        y: Math.random() * 12 + 3,
        z: (Math.random() - 0.5) * 10,
        vy: 1.4 + Math.random() * 1.8,
        vr: (Math.random() - 0.5) * 5,
        rx: Math.random() * 6,
        ry: Math.random() * 6,
        rz: Math.random() * 6,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 1 + Math.random() * 1.5,
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
      d.sway += d.swaySpeed * clamped;
      d.rx += d.vr * clamped;
      d.rz += d.vr * 0.7 * clamped;
      if (d.y < -0.3) d.y = 10 + Math.random() * 4;
      dummy.position.set(d.x + Math.sin(d.sway) * 0.5, d.y, d.z);
      dummy.rotation.set(d.rx, d.ry, d.rz);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, COUNT]}>
      <planeGeometry args={[0.16, 0.26]} />
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.5} metalness={0.1} />
    </instancedMesh>
  );
}

function DrawnTile({ tile }: { tile: DaVinciTile }) {
  const faces = tileFaces(tile);
  const label = tileLabel(tile);
  const faceTexture = useMemo(() => getFaceTexture(label, faces.body, faces.text), [label, faces.body, faces.text]);
  return (
    <group position={[0, 2.6, 1.2]} rotation={[-0.2, 0, 0]}>
      <RoundedBox args={[TILE_W, TILE_H, TILE_D]} radius={0.07} smoothness={4}>
        <meshStandardMaterial color={faces.body} emissive="#5b8def" emissiveIntensity={0.18} metalness={0.2} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0, TILE_D / 2 + 0.004]} raycast={() => null}>
        <planeGeometry args={[TILE_W * 0.96, TILE_H * 0.96]} />
        <meshStandardMaterial map={faceTexture} roughness={0.6} metalness={0.1} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
    </group>
  );
}

function Scene({ state, myMemberId, isMyTurn, selected, onSelectTile }: Props) {
  // Local player rendered at the front (nearest the camera), others behind.
  const ordered = useMemo(() => {
    const players = state.players;
    const meIdx = players.findIndex((p) => p.id === myMemberId);
    if (meIdx < 0) return players.map((p, i) => ({ player: p, originalIndex: i }));
    const rest = players.map((p, i) => ({ player: p, originalIndex: i })).filter((_, i) => i !== meIdx);
    return [{ player: players[meIdx]!, originalIndex: meIdx }, ...rest];
  }, [state.players, myMemberId]);

  const n = ordered.length;
  const current = state.players[state.currentPlayerIndex];
  const inSetup = state.phase === 'setup';
  const ended = state.phase === 'ended';
  const hasWinner = ended && state.winnerId != null;
  const setupReady = state.setupReady.length;
  const setupTotal = state.players.length;

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 12, 8]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-6, 6, -4]} intensity={0.4} color="#9bbcff" />

      {/* table */}
      <mesh position={[0, -0.1, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0c1422" roughness={0.95} />
      </mesh>
      <RoundedBox args={[14, 0.2, n * ROW_GAP + 3]} radius={0.2} smoothness={4} position={[0, -0.02, 0]} receiveShadow>
        <meshStandardMaterial color="#13324a" roughness={0.85} />
      </RoundedBox>

      {ordered.map(({ player }, rowIdx) => {
        const z = ((n - 1) / 2 - rowIdx) * ROW_GAP;
        const isMe = player.id === myMemberId;
        // Back rows face the camera too; flip nothing — labels via Html always face camera.
        const isCurrent = state.phase === 'playing' && player.id === current?.id;
        const selectedIndex =
          selected && selected.targetId === player.id ? selected.tileIndex : null;
        const canSelectRack = isMyTurn && state.stage === 'guessing' && !isMe && !player.eliminated;
        const endState: EndState = !ended
          ? 'none'
          : hasWinner && player.id === state.winnerId
            ? 'winner'
            : 'loser';
        const label = inSetup
          ? `${player.name}${player.isBot ? ' 🤖' : ''}${isMe ? '（你）' : ''} · 待上桌`
          : `${player.name}${player.isBot ? ' 🤖' : ''}${isMe ? '（你）' : ''}` +
            `${endState === 'winner' ? ' · 获胜 🏆' : ''}` +
            `${isCurrent ? ' · 当前回合' : ''}` +
            `${endState !== 'winner' && player.eliminated ? ' · 出局' : ''}`;
        return (
          <Rack
            key={player.id}
            z={z}
            rotateY={0}
            player={player}
            isCurrent={isCurrent}
            selectable={canSelectRack}
            selectedIndex={selectedIndex}
            onSelectTile={(tileIndex) => onSelectTile(player.id, tileIndex)}
            label={label}
            endState={endState}
            hideTiles={inSetup}
          />
        );
      })}

      {inSetup && (
        <Html center position={[0, 1.35, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div
            style={{
              textAlign: 'center',
              padding: '14px 22px',
              borderRadius: 14,
              background: 'rgba(12, 18, 30, 0.82)',
              border: '1px solid rgba(168, 85, 247, 0.45)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
              color: '#e8edf5',
              minWidth: 200,
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: 6, color: '#c4b5fd' }}>
              开局摆放中
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.45 }}>
              牌暂不上桌，请在下方面板完成摆放
            </div>
            <div style={{ marginTop: 10, fontSize: '13px', fontWeight: 700 }}>
              {setupReady}/{setupTotal} 已完成
            </div>
          </div>
        </Html>
      )}

      {state.drawnTile && !ended && !inSetup && <DrawnTile tile={state.drawnTile} />}
      {hasWinner && <Confetti />}

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={16}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 0.5, 0]}
      />
    </>
  );
}

export function DaVinciBoard3D(props: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        background: 'radial-gradient(ellipse at top, #16243f 0%, #0a0f18 70%)',
      }}
    >
      <Canvas shadows camera={{ position: [0, 6.5, 9], fov: 42 }} dpr={[1, 2]}>
        <Scene {...props} />
      </Canvas>
    </div>
  );
}
