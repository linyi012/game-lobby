import { useEffect, useRef } from 'react';
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  ITEM_LABELS,
  MINER_X,
  MINER_Y,
  type GoldMinerGameState,
  type ItemType,
  type MineItem,
} from '@game-lobby/game-engine';

const ITEM_COLORS: Record<ItemType, string> = {
  gold_small: '#ffd700',
  gold_large: '#ffb300',
  diamond: '#80deea',
  rock: '#78909c',
  mystery_bag: '#ce93d8',
  tnt: '#ef5350',
  pig: '#ffab91',
};

function drawItem(ctx: CanvasRenderingContext2D, item: MineItem) {
  if (item.collected) return;
  ctx.fillStyle = ITEM_COLORS[item.type];
  ctx.beginPath();
  ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (item.type !== 'pig' && item.type !== 'mystery_bag' && item.value > 0) {
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${item.value}`, item.x, item.y);
  } else if (item.type === 'mystery_bag') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('?', item.x, item.y);
  } else if (item.type === 'tnt') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('TNT', item.x, item.y);
  } else if (item.type === 'pig') {
    ctx.font = '18px sans-serif';
    ctx.fillText('🐷', item.x - 9, item.y + 6);
  }
}

interface Props {
  state: GoldMinerGameState;
}

export function MineCanvas({ state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, 120);
    skyGrad.addColorStop(0, '#87ceeb');
    skyGrad.addColorStop(1, '#e0c080');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, FIELD_WIDTH, 120);

    ctx.fillStyle = '#5d4037';
    ctx.fillRect(0, 120, FIELD_WIDTH, FIELD_HEIGHT - 120);

    ctx.fillStyle = '#3e2723';
    ctx.fillRect(0, 120, FIELD_WIDTH, 8);

    for (const item of state.items) {
      drawItem(ctx, item);
    }

    const tipX = MINER_X + state.hook.length * Math.sin(state.hook.angle);
    const tipY = MINER_Y + state.hook.length * Math.cos(state.hook.angle);

    ctx.strokeStyle = '#424242';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(MINER_X, MINER_Y);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    ctx.fillStyle = '#616161';
    ctx.beginPath();
    ctx.arc(tipX, tipY, 8, 0, Math.PI * 2);
    ctx.fill();

    const attached = state.hook.attachedItemId
      ? state.items.find((i) => i.id === state.hook.attachedItemId)
      : null;
    if (attached && !attached.collected) {
      drawItem(ctx, { ...attached, x: tipX, y: tipY + attached.radius });
    }

    ctx.fillStyle = '#ffcc80';
    ctx.fillRect(MINER_X - 20, MINER_Y - 28, 40, 24);
    ctx.fillStyle = '#5d4037';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⛏️', MINER_X, MINER_Y - 8);
  }, [state]);

  return (
    <canvas
      ref={canvasRef}
      width={FIELD_WIDTH}
      height={FIELD_HEIGHT}
      style={{
        width: '100%',
        maxWidth: FIELD_WIDTH,
        height: 'auto',
        borderRadius: 8,
        border: '2px solid var(--border)',
        display: 'block',
        margin: '0 auto',
      }}
      aria-label="黄金矿工矿场"
    />
  );
}

export { ITEM_LABELS };
