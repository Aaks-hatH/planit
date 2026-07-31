const ACCENTS = ['#6366f1', '#f97316', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

function initialsFor(name, i) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] || '').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
  }
  return String.fromCharCode(65 + (i % 26));
}

/**
 * Overlapping avatar stack + "X going" label — used on invite/RSVP pages
 * to visualize social proof without needing real guest photos.
 */
export default function GuestAvatarStack({ names = [], count = 0, max = 4, size = 28, label }) {
  const shown = names.length ? names.slice(0, max) : Array.from({ length: Math.min(count, max) });
  if (shown.length === 0 && !count) return null;

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex" style={{ paddingLeft: 2 }}>
        {shown.map((name, i) => (
          <div
            key={i}
            className="rounded-full flex items-center justify-center font-bold text-white ring-2 ring-neutral-950"
            style={{
              width: size, height: size, fontSize: size * 0.36,
              background: ACCENTS[i % ACCENTS.length],
              marginLeft: i === 0 ? 0 : -size * 0.3,
            }}
          >
            {initialsFor(name, i)}
          </div>
        ))}
      </div>
      <span className="text-sm text-neutral-400 font-medium">
        {label || `${count} going`}
      </span>
    </div>
  );
}
