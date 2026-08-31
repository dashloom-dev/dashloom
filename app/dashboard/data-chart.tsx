'use client';

import { useEffect, useRef } from 'react';

type Point = { date: string; value: number };
type Line = { label: string; color: string; points: Point[] };

export function DataChart({ lines, height = 220, label }: { lines: Line[]; height?: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const draw = () => {
      const ratio = Math.max(1, window.devicePixelRatio || 1); const width = canvas.clientWidth;
      canvas.width = width * ratio; canvas.height = height * ratio;
      const context = canvas.getContext('2d'); if (!context) return;
      context.scale(ratio, ratio); context.clearRect(0, 0, width, height);
      const all = lines.flatMap((line) => line.points.map((point) => point.value));
      if (!all.length) return;
      const top = Math.max(...all); const bottom = Math.min(0, ...all); const spread = Math.max(1, top - bottom);
      const pad = { left: 12, right: 12, top: 16, bottom: 22 }; const innerW = width - pad.left - pad.right; const innerH = height - pad.top - pad.bottom;
      context.strokeStyle = 'rgba(142,185,171,.12)'; context.lineWidth = 1;
      for (let i = 0; i < 4; i += 1) { const y = pad.top + (innerH / 3) * i; context.beginPath(); context.moveTo(pad.left, y); context.lineTo(width - pad.right, y); context.stroke(); }
      for (const line of lines) {
        if (!line.points.length) continue; context.beginPath(); context.strokeStyle = line.color; context.lineWidth = 2; context.lineJoin = 'round'; context.lineCap = 'round';
        line.points.forEach((point, index) => { const x = pad.left + (index / Math.max(1, line.points.length - 1)) * innerW; const y = pad.top + (1 - (point.value - bottom) / spread) * innerH; if (!index) context.moveTo(x, y); else context.lineTo(x, y); }); context.stroke();
      }
    };
    draw();
    const observer = new ResizeObserver(draw); observer.observe(canvas);
    return () => observer.disconnect();
  }, [height, lines]);
  return <canvas className="data-canvas" ref={ref} style={{ height }} role="img" aria-label={label} />;
}

export function Sparkline({ points, color = '#59dbae', label }: { points: Point[]; color?: string; label: string }) { return <DataChart lines={[{ label, color, points }]} height={76} label={label} />; }
