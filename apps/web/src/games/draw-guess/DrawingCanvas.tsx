import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrawStroke } from '@game-lobby/game-engine';

const COLORS = ['#ffffff', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#000000'];

interface DrawingCanvasProps {
  strokes: DrawStroke[];
  readOnly?: boolean;
  onStrokeBatch?: (strokes: DrawStroke[]) => void;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: DrawStroke, w: number, h: number) {
  const points = stroke.points;
  if (points.length < 4) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke.width;
  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
  }

  ctx.beginPath();
  ctx.moveTo(points[0]! * w, points[1]! * h);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i]! * w, points[i + 1]! * h);
  }
  ctx.stroke();
  ctx.restore();
}

function renderAll(ctx: CanvasRenderingContext2D, strokes: DrawStroke[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  for (const s of strokes) drawStroke(ctx, s, w, h);
}

export function DrawingCanvas({ strokes, readOnly = false, onStrokeBatch }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(4);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const drawingRef = useRef(false);
  const currentPointsRef = useRef<number[]>([]);
  const strokeIdRef = useRef(0);
  const pendingRef = useRef<DrawStroke[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushStrokes = useCallback(() => {
    if (!onStrokeBatch || pendingRef.current.length === 0) return;
    onStrokeBatch([...pendingRef.current]);
    pendingRef.current = [];
  }, [onStrokeBatch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderAll(ctx, strokes, rect.width, rect.height);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [strokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = container.getBoundingClientRect();
    renderAll(ctx, strokes, rect.width, rect.height);
  }, [strokes]);

  const normPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return [(clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height];
  };

  const scheduleFlush = () => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushStrokes();
    }, 150);
  };

  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const points = currentPointsRef.current;
    currentPointsRef.current = [];
    if (points.length >= 4) {
      strokeIdRef.current += 1;
      const stroke: DrawStroke = {
        id: `local-${strokeIdRef.current}`,
        points,
        color,
        width,
        tool,
      };
      pendingRef.current.push(stroke);
      scheduleFlush();
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const [x, y] = normPoint(e.clientX, e.clientY);
    currentPointsRef.current = [x, y, x, y];
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current || readOnly) return;
    const [x, y] = normPoint(e.clientX, e.clientY);
    currentPointsRef.current.push(x, y);

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = container.getBoundingClientRect();
    const pts = currentPointsRef.current;
    const stroke: DrawStroke = { id: 'preview', points: pts, color, width, tool };
    renderAll(ctx, strokes, rect.width, rect.height);
    drawStroke(ctx, stroke, rect.width, rect.height);
  };

  const onPointerUp = () => endStroke();

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      {!readOnly && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColor(c);
                  setTool('pen');
                }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: color === c && tool === 'pen' ? '2px solid var(--accent)' : '1px solid #ccc',
                  background: c,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            粗细
            <input
              type="range"
              min={2}
              max={16}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className={`btn btn-secondary${tool === 'eraser' ? ' active' : ''}`}
            onClick={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')}
          >
            橡皮擦
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          aspectRatio: '4 / 3',
          background: '#fff',
          borderRadius: 8,
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', cursor: readOnly ? 'default' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
    </div>
  );
}

export { COLORS };
