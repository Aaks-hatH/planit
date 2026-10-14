/**
 * frontend/src/components/rsvpBlocks/BlockContentEditor.jsx
 *
 * Renders the right set of fields for a section's `content` based on
 * CONTENT_SCHEMA (contentSchema.js). One generic implementation instead of
 * a bespoke form per block type — see that file's header for why.
 */
import React, { useState } from 'react';
import { Plus, Trash2, ImagePlus, Loader2, Info, Sparkles, UploadCloud, Eye, EyeOff } from 'lucide-react';
import { CONTENT_SCHEMA } from './contentSchema';
import { fileAPI } from '../../services/api';
import HeroAdjustPanel from './HeroAdjustPanel';
import ColorWheelPicker from './ColorWheelPicker';
import InfoTooltip from './InfoTooltip';

function toDatetimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ImageUploadField({ eventId, value, onChange, purpose }) {
  const [busy, setBusy] = useState(false);
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await fileAPI.upload(eventId, fd, purpose);
      onChange(res.data.file.url);
    } catch (err) {
      console.error('Image upload failed', err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      {value ? (
        <img src={value} alt="" className="w-10 h-10 rounded object-cover border border-white/10" />
      ) : (
        <div className="w-10 h-10 rounded border border-dashed border-white/20 flex items-center justify-center">
          <ImagePlus size={16} className="opacity-40" />
        </div>
      )}
      <label className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 cursor-pointer flex items-center gap-1">
        {busy ? <Loader2 size={12} className="animate-spin" /> : null}
        {value ? 'Replace' : 'Upload'}
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={busy} />
      </label>
    </div>
  );
}

function Field({ eventId, field, value, onChange }) {
  switch (field.type) {
    case 'textarea':
      return <textarea rows={3} className="w-full text-sm rounded-lg bg-white/5 border border-white/10 px-3 py-2" value={value || ''} onChange={(e) => onChange(e.target.value)} />;
    case 'datetime':
      return <input type="datetime-local" className="w-full text-sm rounded-lg bg-white/5 border border-white/10 px-3 py-2" value={toDatetimeLocal(value)} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />;
    case 'number':
      return <input type="number" className="w-full text-sm rounded-lg bg-white/5 border border-white/10 px-3 py-2" value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} />;
    case 'url':
      return <input type="url" placeholder="https://" className="w-full text-sm rounded-lg bg-white/5 border border-white/10 px-3 py-2" value={value || ''} onChange={(e) => onChange(e.target.value)} />;
    case 'imageUpload':
      return <ImageUploadField eventId={eventId} value={value} onChange={onChange} />;
    default:
      return <input type="text" className="w-full text-sm rounded-lg bg-white/5 border border-white/10 px-3 py-2" value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

function ListEditor({ eventId, field, items = [], onChange }) {
  const isPlainStrings = !field.itemFields;
  const addItem = () => onChange([...(items || []), isPlainStrings ? '' : Object.fromEntries(field.itemFields.map((f) => [f.key, '']))]);
  const removeItem = (i) => onChange(items.filter((_, idx) => idx !== i));
  const updateItem = (i, next) => onChange(items.map((it, idx) => (idx === i ? next : it)));

  return (
    <div className="flex flex-col gap-2">
      {(items || []).map((item, i) => (
        <div key={i} className="rounded-lg border border-white/10 p-2 flex flex-col gap-2 relative">
          <button type="button" onClick={() => removeItem(i)} className="absolute top-1.5 right-1.5 opacity-40 hover:opacity-100">
            <Trash2 size={12} />
          </button>
          {isPlainStrings ? (
            <input
              type="text"
              className="w-full text-sm rounded bg-white/5 border border-white/10 px-2 py-1.5 pr-6"
              value={item}
              onChange={(e) => updateItem(i, e.target.value)}
            />
          ) : (
            field.itemFields.map((sf) => (
              <div key={sf.key} className="flex flex-col gap-1">
                <label className="text-[11px] uppercase tracking-wide opacity-50">{sf.label}</label>
                <Field eventId={eventId} field={sf} value={item[sf.key]} onChange={(v) => updateItem(i, { ...item, [sf.key]: v })} />
              </div>
            ))
          )}
        </div>
      ))}
      <button type="button" onClick={addItem} className="self-start text-xs flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10">
        <Plus size={12} /> Add {field.label.toLowerCase().replace(/s$/, '')}
      </button>
    </div>
  );
}

function CoverPickerField({
  eventId, coverTemplates = [], accentColor, coverPreviewUrl, generating, onGenerate,
  uploadedUrl, onUploadImage, onClearUpload, showOverlayText, onToggleOverlayText,
  uploadedUrlDesktop, onUploadImageDesktop, onClearUploadDesktop,
}) {
  const [template, setTemplate] = useState('centered-stack');
  const [mode, setMode] = useState(uploadedUrl ? 'upload' : 'generate');
  const [uploading, setUploading] = useState(false);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [desktopEnabled, setDesktopEnabled] = useState(!!uploadedUrlDesktop);

  // The generated-cover preview only applies in 'generate' mode — an
  // uploaded image always wins on the actual page (see RSVPPageRenderer's
  // resolution order), so showing it here too when an upload is active
  // would misrepresent what guests will actually see.
  const previewUrl = mode === 'upload' ? uploadedUrl : coverPreviewUrl;
  const hasCover = !!(uploadedUrl || coverPreviewUrl);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUploadImage?.(file);
      setMode('upload');
    } finally {
      setUploading(false);
    }
  };

  const handleFileDesktop = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDesktop(true);
    try {
      await onUploadImageDesktop?.(file);
    } finally {
      setUploadingDesktop(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Preview shows the SOURCE image un-cropped (object-contain) — the
          real, device-accurate crop preview lives in the "Crop & position"
          panel below, so this doesn't show a third, misleading aspect ratio. */}
      {previewUrl && (
        <div className="w-full rounded-lg border border-white/10 bg-black/30 flex items-center justify-center overflow-hidden" style={{ maxHeight: 160 }}>
          <img src={previewUrl} alt="Banner source" className="max-w-full max-h-40 object-contain" />
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 flex items-start gap-2">
        <Info size={12} className="mt-0.5 shrink-0 text-white/35" />
        <p className="text-[11px] leading-relaxed text-white/55">
          Pick <strong className="text-white/80 font-semibold">one</strong> source for your banner — generate a graphic from your event details, or upload your own photo. Switching to the other mode replaces whichever one is active.
        </p>
      </div>

      <div className="flex gap-1 p-0.5 rounded-lg bg-white/5 w-fit">
        <button type="button" onClick={() => setMode('generate')}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md transition-colors"
          style={mode === 'generate' ? { background: accentColor, color: '#0a0a12' } : { opacity: 0.6 }}>
          <Sparkles size={11} /> Generate
        </button>
        <button type="button" onClick={() => setMode('upload')}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md transition-colors"
          style={mode === 'upload' ? { background: accentColor, color: '#0a0a12' } : { opacity: 0.6 }}>
          <UploadCloud size={11} /> Upload your own
        </button>
        <InfoTooltip
          side="right"
          text="Generate: PlanIt draws a banner graphic that already includes your title, date and host — no photo needed. Upload: use your own photo instead; add your title back on top with the toggle below."
        />
      </div>

      {mode === 'generate' && (
        <>
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wide opacity-50">Style</span>
            <InfoTooltip text="The layout used to arrange your title, date and host name inside the generated graphic." />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {coverTemplates.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTemplate(t)}
                className="text-[11px] px-2 py-1 rounded-full border"
                style={template === t ? { borderColor: accentColor, color: accentColor } : { borderColor: 'rgba(255,255,255,0.15)', opacity: 0.6 }}
              >
                {t.replace(/-/g, ' ')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onGenerate(template)}
              disabled={generating}
              className="self-start text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: accentColor, color: '#0a0a12' }}
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {coverPreviewUrl ? 'Regenerate cover' : 'Generate cover'}
            </button>
            <InfoTooltip text="Rebuilds the graphic fresh from your current title, date and host name — the previous version is replaced. Your title's text field above stays editable even though it also appears in the image." />
          </div>
        </>
      )}

      {mode === 'upload' && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer flex items-center gap-1.5 w-fit">
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
            {uploadedUrl ? 'Replace image' : 'Upload image'}
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
          {uploadedUrl && (
            <button type="button" onClick={onClearUpload} className="text-xs text-red-400 hover:text-red-300">
              Remove
            </button>
          )}
          <span className="text-[11px] opacity-40 flex items-center gap-1">
            Cropped to fit below
            <InfoTooltip text="Uploaded photos aren't resized on upload — use the Crop & position panel below to choose what part shows on desktop vs. mobile." />
          </span>
        </div>
      )}

      {hasCover && (
        <div className="rounded-lg border border-white/10 p-2.5 flex flex-col gap-2">
          <label className="flex items-start gap-2 text-[11px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={desktopEnabled}
              onChange={(e) => {
                const checked = e.target.checked;
                setDesktopEnabled(checked);
                if (!checked) onClearUploadDesktop?.();
              }}
              className="accent-current mt-0.5"
              style={{ accentColor }}
            />
            <span className="flex-1">
              <span className="opacity-85 font-medium">Use a different image for desktop</span>
              <InfoTooltip text="Some banners just don't translate across screen shapes: a tall poster or invite card that fills a phone screen nicely can leave huge gaps or crop badly on a wide desktop banner — and a wide landscape photo can do the same in reverse on mobile. Upload a second image cropped for the other shape instead of forcing one image to do both jobs. Leave this off to keep using the same image everywhere." />
            </span>
          </label>
          {desktopEnabled && (
            <div className="pl-6 flex flex-col gap-2">
              {uploadedUrlDesktop && (
                <img src={uploadedUrlDesktop} alt="Desktop banner source" className="max-w-full max-h-24 object-contain rounded border border-white/10 bg-black/30" />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer flex items-center gap-1.5 w-fit">
                  {uploadingDesktop ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                  {uploadedUrlDesktop ? 'Replace desktop image' : 'Upload desktop image'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileDesktop} disabled={uploadingDesktop} />
                </label>
                {uploadedUrlDesktop && (
                  <button type="button" onClick={onClearUploadDesktop} className="text-xs text-red-400 hover:text-red-300">
                    Remove
                  </button>
                )}
              </div>
              <span className="text-[11px] opacity-40">
                Crop it separately below, under the "Desktop" tab of Crop &amp; position.
              </span>
            </div>
          )}
        </div>
      )}

      {hasCover && (
        <label className="flex items-center gap-2 mt-1 text-[11px] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showOverlayText !== false}
            onChange={(e) => onToggleOverlayText?.(e.target.checked)}
            className="accent-current"
            style={{ accentColor }}
          />
          <span className="inline-flex items-center gap-1 opacity-75">
            {showOverlayText !== false ? <Eye size={12} /> : <EyeOff size={12} />}
            Show title &amp; details over the banner
          </span>
          <InfoTooltip text="Generated banners already draw your title, date and host as part of the graphic — leaving this on too would stack duplicate text on top of it, so it's switched off by default for generated covers. Uploaded photos have no text of their own, so it's on by default for those." />
        </label>
      )}
    </div>
  );
}

function FieldLabel({ children, hint }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide opacity-50">
      {children}
      {hint && <InfoTooltip text={hint} />}
    </span>
  );
}

export default function BlockContentEditor({ eventId, type, content, onChange, coverProps }) {
  const schema = CONTENT_SCHEMA[type] || [];
  if (!schema.length) return <p className="text-xs opacity-50 italic">This block has no editable content.</p>;

  const set = (key, value) => onChange({ ...content, [key]: value });

  return (
    <div className="flex flex-col gap-3">
      {type === 'hero' && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 flex items-start gap-2">
          <Info size={13} className="mt-0.5 shrink-0 text-white/40" />
          <div className="text-[11px] leading-relaxed text-white/60 space-y-1">
            <p><strong className="text-white/85">How the banner works:</strong> generate a graphic from your event details, or upload your own photo — not both at once.</p>
            <p>Then use <strong className="text-white/85">Crop &amp; position</strong> to fit it on desktop and mobile, since the banner isn't the same shape on both — and optionally upload a second image just for desktop if one photo doesn't work well on both screen shapes.</p>
          </div>
        </div>
      )}
      {schema.map((field) => {
        if (field.type === 'coverPicker') {
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <FieldLabel hint={field.hint}>{field.label}</FieldLabel>
              <CoverPickerField
                eventId={eventId}
                coverTemplates={coverProps?.coverTemplates}
                accentColor={coverProps?.accentColor}
                coverPreviewUrl={coverProps?.coverPreviewUrl}
                generating={coverProps?.generating}
                onGenerate={(template) => coverProps?.onGenerate?.(template)}
                uploadedUrl={content?.coverImageUrl}
                showOverlayText={content?.showOverlayText}
                onToggleOverlayText={(checked) => onChange({ ...content, showOverlayText: checked })}
                onUploadImage={async (file) => {
                  const fd = new FormData();
                  fd.append('files', file);
                  const res = await fileAPI.upload(eventId, fd, 'cover');
                  onChange({
                    ...content,
                    coverImageUrl: res.data.file.url,
                    // An uploaded photo has no text of its own baked in, so
                    // make sure the overlay is on the first time someone
                    // uploads — but leave it alone on a "Replace image" if
                    // they'd already deliberately turned it off.
                    showOverlayText: content?.coverImageUrl ? content?.showOverlayText : true,
                  });
                }}
                onClearUpload={() => onChange({ ...content, coverImageUrl: null })}
                uploadedUrlDesktop={content?.coverImageUrlDesktop}
                onUploadImageDesktop={async (file) => {
                  const fd = new FormData();
                  fd.append('files', file);
                  const res = await fileAPI.upload(eventId, fd, 'cover');
                  onChange({ ...content, coverImageUrlDesktop: res.data.file.url });
                }}
                onClearUploadDesktop={() => onChange({
                  ...content,
                  coverImageUrlDesktop: null,
                  imageZoomDesktop: undefined,
                  imagePositionDesktop: undefined,
                  imageFitDesktop: undefined,
                })}
              />
            </div>
          );
        }
        if (field.type === 'heroAdjust') {
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <FieldLabel hint={field.hint}>{field.label}</FieldLabel>
              <HeroAdjustPanel
                imageUrl={content?.coverImageUrl || coverProps?.coverPreviewUrl || null}
                imageUrlDesktop={content?.coverImageUrlDesktop || null}
                imageZoom={content?.imageZoom}
                imagePosition={content?.imagePosition}
                imageFit={content?.imageFit}
                imageZoomDesktop={content?.imageZoomDesktop}
                imagePositionDesktop={content?.imagePositionDesktop}
                imageFitDesktop={content?.imageFitDesktop}
                textPosition={content?.textPosition}
                onChange={(patch) => onChange({ ...content, ...patch })}
              />
            </div>
          );
        }
        if (field.type === 'colorWheel') {
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <FieldLabel hint={field.hint}>{field.label}</FieldLabel>
              <ColorWheelPicker
                value={content?.[field.key] || null}
                defaultColor={coverProps?.accentColor || '#6366f1'}
                onChange={(hex) => onChange({ ...content, [field.key]: hex })}
              />
            </div>
          );
        }
        return (
          <div key={field.key} className="flex flex-col gap-1">
            <FieldLabel hint={field.hint}>{field.label}</FieldLabel>
            {field.type === 'list'
              ? <ListEditor eventId={eventId} field={field} items={content?.[field.key]} onChange={(v) => set(field.key, v)} />
              : <Field eventId={eventId} field={field} value={content?.[field.key]} onChange={(v) => set(field.key, v)} />}
          </div>
        );
      })}
    </div>
  );
}
