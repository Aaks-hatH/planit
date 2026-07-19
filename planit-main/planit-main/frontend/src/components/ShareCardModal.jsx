import { useEffect, useRef, useState } from 'react';
import { X, Download, Share2, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { drawShareCard, downloadCanvasAsPng, canvasToBlob } from '../utils/shareCard';

/**
 * Renders a personalized, downloadable share card for an event.
 * Every card carries the PlanIt wordmark — this is the component behind
 * the platform's guest-driven distribution loop.
 */
export default function ShareCardModal({ open, onClose, eventTitle, dateLabel, location, guestName, goingCount, url }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReady(false);
    let cancelled = false;
    (async () => {
      if (!canvasRef.current) return;
      await drawShareCard(canvasRef.current, { eventTitle, dateLabel, location, guestName, goingCount, siteUrl: url });
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [open, eventTitle, dateLabel, location, guestName, goingCount, url]);

  if (!open) return null;

  const filename = `${(eventTitle || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-invite.png`;

  const handleDownload = () => {
    if (!canvasRef.current) return;
    downloadCanvasAsPng(canvasRef.current, filename);
    toast.success('Share card downloaded');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Failed to copy link'); }
  };

  const handleNativeShare = async () => {
    if (!canvasRef.current) return;
    try {
      if (navigator.share) {
        const blob = await canvasToBlob(canvasRef.current);
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: eventTitle, text: `I'm going to ${eventTitle}`, url });
          return;
        }
        await navigator.share({ title: eventTitle, text: `I'm going to ${eventTitle}`, url });
      } else {
        handleDownload();
      }
    } catch { /* user cancelled share sheet — not an error */ }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
      style={{ backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Share your invite</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-neutral-900 mb-5" style={{ aspectRatio: '4 / 5' }}>
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
            </div>
          )}
          <canvas ref={canvasRef} className="w-full h-full object-contain" style={{ opacity: ready ? 1 : 0 }} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={handleDownload}
            disabled={!ready}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-neutral-200 bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-700 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Save image
          </button>
          <button
            onClick={handleNativeShare}
            disabled={!ready}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
        <button
          onClick={handleCopyLink}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Link copied' : 'Or just copy the link'}
        </button>
      </div>
    </div>
  );
}
