import { useEffect, useRef, useState } from 'react';
import { MULTIPLIERS, ROWS } from './config';

interface PlinkoBoardProps {
  rows?: number;
  riskLevel: 0 | 1 | 2;
  dropping: boolean;
  onLand: (bucketIndex: number) => void;
  result?: number | null; // bucket index from contract
}

const RISK_LABELS = ['Low', 'Mid', 'High'];
const RISK_COLORS = ['#00cfff', '#b44fff', '#ff2d9b'];

export default function PlinkoBoard({ rows = ROWS, riskLevel, dropping, onLand, result }: PlinkoBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [ballPos, setBallPos] = useState<{ x: number; y: number } | null>(null);
  const [landed, setLanded] = useState<number | null>(null);

  const W = 780;
  const H = 720;
  const PAD = 40;
  const COLS = rows + 1;
  const colW = (W - PAD * 2) / (COLS - 1);
  const rowH = (H - PAD * 2 - 60) / rows;

  // Pin positions
  const pins: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    const count = r + 2;
    const startX = PAD + ((COLS - 1 - r) / 2) * colW;
    for (let c = 0; c < count; c++) {
      pins.push({ x: startX + c * colW, y: PAD + r * rowH + rowH });
    }
  }

  // Draw board
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#080818';
    ctx.fillRect(0, 0, W, H);

    // Multiplier buckets
    const risk = ['low', 'mid', 'high'][riskLevel] as keyof typeof MULTIPLIERS;
    const mults = MULTIPLIERS[risk];
    const bucketW = colW;
    const bucketY = H - 55;

    for (let i = 0; i < COLS; i++) {
      const bx = PAD + i * colW - bucketW / 2;
      const mult = mults[Math.min(i, mults.length - 1)];
      const isLanded = landed === i;

      ctx.fillStyle = isLanded ? '#ffd70033' : mult >= 2 ? '#ffd70022' : mult >= 1 ? '#00cfff18' : '#ff2d9b15';
      ctx.strokeStyle = isLanded ? '#ffd700' : '#b44fff44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.beginPath(); ctx.moveTo(bx+6, bucketY); ctx.lineTo(bx+bucketW-6, bucketY); ctx.quadraticCurveTo(bx+bucketW-2, bucketY, bx+bucketW-2, bucketY+4); ctx.lineTo(bx+bucketW-2, bucketY+40); ctx.quadraticCurveTo(bx+bucketW-2, bucketY+44, bx+bucketW-6, bucketY+44); ctx.lineTo(bx+6, bucketY+44); ctx.quadraticCurveTo(bx+2, bucketY+44, bx+2, bucketY+40); ctx.lineTo(bx+2, bucketY+4); ctx.quadraticCurveTo(bx+2, bucketY, bx+6, bucketY); ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isLanded ? '#ffd700' : mult >= 5 ? '#ff2d9b' : mult >= 1 ? '#00cfff' : '#b44fff';
      ctx.font = `bold ${mult >= 10 ? 10 : 12}px Poppins, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${mult}x`, PAD + i * colW, bucketY + 26);
    }

    // Pins
    for (const pin of pins) {
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#b44fff99';
      ctx.fill();
    }

    // Ball
    if (ballPos) {
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ff2d9b';
      ctx.shadowColor = '#f0b800';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [ballPos, landed, riskLevel, rows]);

  // Animate drop when result comes in
  useEffect(() => {
    if (result === null || result === undefined || !dropping) return;

    setLanded(null);
    setBallPos(null);

    // Simulate path: ball falls through rows, bouncing left/right toward result bucket
    const startX = W / 2;
    const startY = PAD - 10;
    const endX = PAD + result * colW;
    const endBucketY = H - 55;

    const frames: { x: number; y: number }[] = [];
    const totalFrames = 90; // ~3 seconds at 30fps

    for (let f = 0; f <= totalFrames; f++) {
      const t = f / totalFrames;
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      // Add wobble as it bounces off pins
      const wobble = Math.sin(t * rows * Math.PI * 1.5) * colW * 0.2 * (1 - t);
      frames.push({
        x: startX + (endX - startX) * eased + wobble,
        y: startY + (endBucketY - startY) * eased,
      });
    }

    let i = 0;
    const tick = () => {
      if (i >= frames.length) {
        setLanded(result);
        onLand(result);
        return;
      }
      setBallPos(frames[i]);
      i++;
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [result, dropping, riskLevel, rows]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ borderRadius: 12, border: '1px solid #ffffff22', display: 'block' }}
      />
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: RISK_COLORS[riskLevel] }}>
        {RISK_LABELS[riskLevel]} Risk
      </div>
    </div>
  );
}
