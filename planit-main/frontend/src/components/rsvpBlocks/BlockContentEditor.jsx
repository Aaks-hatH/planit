/**
 * frontend/src/components/rsvpBlocks/BlockContentEditor.jsx
 *
 * Renders the right set of fields for a section's `content` based on
 * CONTENT_SCHEMA (contentSchema.js). One generic implementation instead of
 * a bespoke form per block type — see that file's header for why.
 */
import React, { useState } from 'react';
import { Plus, Trash2, ImagePlus, Loader2 } from 'lucide-react';
import { CONTENT_SCHEMA } from './contentSchema';
import { fileAPI } from '../../services/api';

function toDatetimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ImageUploadField({ eventId, value, onChange }) {
  const [busy, setBusy] = useState(false);
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await fileAPI.upload(eventId, fd);
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

function CoverPickerField({ coverTemplates = [], accentColor, coverPreviewUrl, generating, onGenerate }) {
  const [template, setTemplate] = useState('centered-stack');
  return (
    <div className="flex flex-col gap-2">
      {coverPreviewUrl && (
        <img src={coverPreviewUrl} alt="Cover preview" className="w-full rounded-lg border border-white/10 aspect-[1200/630] object-cover" />
      )}
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
      <button
        type="button"
        onClick={() => onGenerate(template)}
        disabled={generating}
        className="self-start text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
        style={{ background: accentColor, color: '#0a0a12' }}
      >
        {generating ? <Loader2 size={12} className="animate-spin" /> : null}
        {coverPreviewUrl ? 'Regenerate cover' : 'Generate cover'}
      </button>
    </div>
  );
}

export default function BlockContentEditor({ eventId, type, content, onChange, coverProps }) {
  const schema = CONTENT_SCHEMA[type] || [];
  if (!schema.length) return <p className="text-xs opacity-50 italic">This block has no editable content.</p>;

  const set = (key, value) => onChange({ ...content, [key]: value });

  return (
    <div className="flex flex-col gap-3">
      {schema.map((field) => {
        if (field.type === 'coverPicker') {
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-wide opacity-50">{field.label}</label>
              <CoverPickerField
                coverTemplates={coverProps?.coverTemplates}
                accentColor={coverProps?.accentColor}
                coverPreviewUrl={coverProps?.coverPreviewUrl}
                generating={coverProps?.generating}
                onGenerate={(template) => coverProps?.onGenerate?.(template)}
              />
            </div>
          );
        }
        return (
          <div key={field.key} className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide opacity-50">{field.label}</label>
            {field.type === 'list'
              ? <ListEditor eventId={eventId} field={field} items={content?.[field.key]} onChange={(v) => set(field.key, v)} />
              : <Field eventId={eventId} field={field} value={content?.[field.key]} onChange={(v) => set(field.key, v)} />}
          </div>
        );
      })}
    </div>
  );
}
