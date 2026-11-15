import { useEffect, useState } from 'react';

function getParts(date) {
  const diff = new Date(date) - new Date();
  if (diff <= 0) return null;
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}

/** Live-ticking countdown to an event date. Renders nothing once the date has passed. */
export default function EventCountdown({ date, accent = '#e5e5e5', compact = false }) {
  const [parts, setParts] = useState(() => getParts(date));

  useEffect(() => {
    if (!date) return;
    const tick = () => setParts(getParts(date));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [date]);

  if (!parts) return null;

  const units = [['d', 'days'], ['h', 'hrs'], ['m', 'min'], ['s', 'sec']];
  return (
    <div className="flex gap-2">
      {units.map(([k, lbl]) => (
        <div
          key={k}
          className="text-center rounded-lg bg-neutral-900/70 border border-neutral-800"
          style={{ padding: compact ? '6px 8px' : '10px 12px', minWidth: compact ? 44 : 56 }}
        >
          <div className="font-mono font-bold tabular-nums" style={{ color: accent, fontSize: compact ? 16 : 22 }}>
            {String(parts[k]).padStart(2, '0')}
          </div>
          <div className="text-neutral-600 uppercase tracking-wider" style={{ fontSize: 9 }}>{lbl}</div>
        </div>
      ))}
    </div>
  );
}