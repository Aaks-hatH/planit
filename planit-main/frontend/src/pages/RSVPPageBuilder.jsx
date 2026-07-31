/**
 * frontend/src/pages/RSVPPageBuilder.jsx
 *
 * Section-based, drag-and-drop RSVP page builder. Replaces the old flat
 * settings-form builder. This file is the ONLY place in the app that
 * imports dnd-kit — RSVPPage.jsx (the public page) never does, so a
 * production build of the public route doesn't carry the builder's drag
 * dependencies. (Verify this against the real Vite/Rollup output before
 * calling Part 3's bundle-size requirement done — see RSVPPageRenderer.jsx.)
 *
 * Left rail: reorderable section list, rsvpForm pinned last with no handle.
 * Right: live, real-scale preview via the exact same RSVPPageRenderer the
 * public page uses.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft, ExternalLink, GripVertical, ChevronDown, Plus, Trash2,
  Check, Loader2, AlertCircle, Monitor, Smartphone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { rsvpAPI } from '../services/api';
import RSVPPageRenderer from '../components/RSVPPageRenderer';
import RSVPSettings from '../components/RSVPSettings';
import BlockContentEditor from '../components/rsvpBlocks/BlockContentEditor';
import { BLOCK_TYPES, LAYOUT_VARIANTS, PRESET_COLORS } from '../components/rsvpBlocks/theme';
import { BLOCK_LABELS, defaultContentFor } from '../components/rsvpBlocks/contentSchema';

const FIXED_ID = 'rsvp-form-fixed';
const AUTOSAVE_DELAY_MS = 800;

function newSectionId(type) {
  return `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ── one draggable card in the left rail ─────────────────────────────── */
function SectionCard({ section, isFixed, expanded, onToggleExpand, onChangeLayout, onChangeStyle, onChangeContent, onDelete, eventId, coverProps }) {
  const sortable = useSortable({ id: section.id, disabled: isFixed });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  const variants = LAYOUT_VARIANTS[section.type] || [];

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={`rounded-xl border ${isFixed ? 'border-white/20 bg-white/[0.04]' : 'border-white/10 bg-white/[0.02]'} ${sortable.isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        {!isFixed && (
          <button type="button" {...sortable.attributes} {...sortable.listeners} className="cursor-grab active:cursor-grabbing opacity-50 hover:opacity-90 touch-none">
            <GripVertical size={16} />
          </button>
        )}
        {isFixed && <div className="w-4" />}
        <span className="text-sm font-medium flex-1">{BLOCK_LABELS[section.type] || section.type}</span>

        {variants.length > 1 && (
          <div className="flex rounded-full bg-white/5 p-0.5 text-[11px]">
            {variants.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChangeLayout(v)}
                className={`px-2 py-0.5 rounded-full ${section.layout === v ? 'bg-white/15' : 'opacity-50'}`}
              >
                {v}
              </button>
            ))}
          </div>
        )}

        <button type="button" onClick={onToggleExpand} className="opacity-60 hover:opacity-100">
          <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {!isFixed && (
          <button type="button" onClick={onDelete} className="opacity-40 hover:opacity-100 hover:text-red-400">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/10 flex flex-col gap-4">
          {!isFixed && (
            <div>
              <p className="text-[11px] uppercase tracking-wide opacity-50 mb-2">Content</p>
              <BlockContentEditor
                eventId={eventId}
                type={section.type}
                content={section.content}
                onChange={onChangeContent}
                coverProps={section.type === 'hero' ? coverProps : undefined}
              />
            </div>
          )}

          <div>
            <p className="text-[11px] uppercase tracking-wide opacity-50 mb-2">Style</p>
            <div className="flex flex-wrap gap-3 items-center">
              <label className="flex items-center gap-1.5 text-xs">
                Spacing
                <select
                  className="rounded bg-white/5 border border-white/10 px-1.5 py-1"
                  value={section.style?.spacing || 'default'}
                  onChange={(e) => onChangeStyle({ ...section.style, spacing: e.target.value })}
                >
                  <option value="compact">Compact</option>
                  <option value="default">Default</option>
                  <option value="spacious">Spacious</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                Align
                <select
                  className="rounded bg-white/5 border border-white/10 px-1.5 py-1"
                  value={section.style?.alignment || 'center'}
                  onChange={(e) => onChangeStyle({ ...section.style, alignment: e.target.value })}
                >
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                Accent
                <input
                  type="color"
                  className="w-6 h-6 rounded bg-transparent border-0"
                  value={section.style?.accentOverride || '#6366f1'}
                  onChange={(e) => onChangeStyle({ ...section.style, accentOverride: e.target.value })}
                />
                {section.style?.accentOverride && (
                  <button type="button" className="opacity-50 hover:opacity-100" onClick={() => onChangeStyle({ ...section.style, accentOverride: null })}>
                    reset
                  </button>
                )}
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ state }) {
  if (state === 'saving') return <span className="flex items-center gap-1.5 text-xs opacity-60"><Loader2 size={12} className="animate-spin" /> Saving…</span>;
  if (state === 'saved') return <span className="flex items-center gap-1.5 text-xs text-emerald-400"><Check size={12} /> Saved</span>;
  if (state === 'error') return <span className="flex items-center gap-1.5 text-xs text-red-400"><AlertCircle size={12} /> Couldn't save</span>;
  return <span className="text-xs opacity-30">—</span>;
}

export default function RSVPPageBuilder() {
  const { subdomain, eventId: paramEventId } = useParams();
  const navigate = useNavigate();

  const [eventId, setEventId] = useState(paramEventId || null);
  const [event, setEvent] = useState(null);
  const [flatSettings, setFlatSettings] = useState({});
  const [seatingMapEnabled, setSeatingMapEnabled] = useState(false);
  const [coverTemplates, setCoverTemplates] = useState([]);
  const [coverUrlsById, setCoverUrlsById] = useState({});
  const [coverGenerating, setCoverGenerating] = useState(false);

  const [config, setConfig] = useState(null); // { accentColor, sections }
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [viewMode, setViewMode] = useState('desktop');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [activeTab, setActiveTab] = useState('design'); // 'design' | 'settings'
  const [orgRsvpPage, setOrgRsvpPage] = useState(null); // full organizer-only settings (on/off, access, notifications, security, etc.)

  const saveTimer = useRef(null);
  const latestConfigRef = useRef(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  /* ── load ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      try {
        const pageRes = await rsvpAPI.getPage(paramEventId || subdomain);
        const eid = pageRes.data.eventId;
        if (!eid) { toast.error('Event not found'); setLoading(false); return; }
        setEventId(eid);
        setEvent({
          title: pageRes.data.rawTitle || pageRes.data.title,
          date: pageRes.data.date,
          location: pageRes.data.location,
          organizerName: pageRes.data.organizerName,
          subdomain: pageRes.data.subdomain,
        });

        const [cfgRes, settingsRes] = await Promise.all([
          rsvpAPI.getPageConfig(eid),
          rsvpAPI.getSettings(eid),
        ]);
        setConfig(cfgRes.data.rsvpPageConfig);
        setFlatSettings(cfgRes.data.flatSettings || {});
        setSeatingMapEnabled(!!cfgRes.data.seatingMapEnabled);
        setCoverTemplates(cfgRes.data.coverTemplates || []);
        setOrgRsvpPage(settingsRes.data.rsvpPage || {});
      } catch (err) {
        console.error(err);
        toast.error('Could not load the RSVP page builder.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [paramEventId, subdomain]);

  /* ── debounced autosave ───────────────────────────────────────────── */
  const scheduleSave = useCallback((nextConfig) => {
    latestConfigRef.current = nextConfig;
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await rsvpAPI.updatePageConfig(eventId, latestConfigRef.current);
        setSaveState('saved');
      } catch (err) {
        console.error(err);
        setSaveState('error');
        toast.error(err?.response?.data?.error || 'Could not save changes.');
      }
    }, AUTOSAVE_DELAY_MS);
  }, [eventId]);

  const updateConfig = useCallback((updater) => {
    setConfig((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  /* ── section mutations ────────────────────────────────────────────── */
  const sections = config?.sections || [];
  const bodySections = sections.filter((s) => s.type !== 'rsvpForm');
  const fixedSection = sections.find((s) => s.type === 'rsvpForm');

  const handleDragEnd = (evt) => {
    const { active, over } = evt;
    if (!over || active.id === over.id) return;
    updateConfig((prev) => {
      const body = prev.sections.filter((s) => s.type !== 'rsvpForm');
      const fixed = prev.sections.find((s) => s.type === 'rsvpForm');
      const oldIndex = body.findIndex((s) => s.id === active.id);
      const newIndex = body.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(body, oldIndex, newIndex);
      return { ...prev, sections: [...reordered, fixed] };
    });
  };

  const addSection = (type, atIndex) => {
    const variants = LAYOUT_VARIANTS[type] || [];
    const section = {
      id: newSectionId(type),
      type,
      layout: variants[0] || null,
      style: { spacing: 'default', alignment: 'center', accentOverride: null },
      content: defaultContentFor(type),
    };
    updateConfig((prev) => {
      const body = prev.sections.filter((s) => s.type !== 'rsvpForm');
      const fixed = prev.sections.find((s) => s.type === 'rsvpForm');
      const insertAt = atIndex ?? body.length;
      const nextBody = [...body.slice(0, insertAt), section, ...body.slice(insertAt)];
      return { ...prev, sections: [...nextBody, fixed] };
    });
    setExpandedId(section.id);
    setAddMenuOpen(false);
  };

  const deleteSection = (id) => {
    updateConfig((prev) => ({ ...prev, sections: prev.sections.filter((s) => s.id !== id) }));
  };

  const patchSection = (id, patch) => {
    updateConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const handleGenerateCover = async (sectionId, template) => {
    setCoverGenerating(true);
    try {
      const res = await rsvpAPI.generateCover(eventId, { template, accentColor: config.accentColor });
      setCoverUrlsById((prev) => ({ ...prev, [res.data.fileId]: res.data.cloudinaryUrl }));
      patchSection(sectionId, { content: { ...sections.find((s) => s.id === sectionId)?.content, coverImageId: res.data.fileId } });
    } catch (err) {
      console.error(err);
      toast.error('Could not generate the cover graphic.');
    } finally {
      setCoverGenerating(false);
    }
  };

  const previewConfig = useMemo(() => config, [config]);

  // Re-pull settings + flatSettings after the Settings tab saves, so the live
  // preview (which reads flatSettings for the pinned rsvpForm block) and the
  // Settings panel itself both reflect what was just persisted.
  const refreshSettings = useCallback(async () => {
    if (!eventId) return;
    try {
      const [cfgRes, settingsRes] = await Promise.all([
        rsvpAPI.getPageConfig(eventId),
        rsvpAPI.getSettings(eventId),
      ]);
      setFlatSettings(cfgRes.data.flatSettings || {});
      setSeatingMapEnabled(!!cfgRes.data.seatingMapEnabled);
      setOrgRsvpPage(settingsRes.data.rsvpPage || {});
    } catch (err) {
      console.error(err);
    }
  }, [eventId]);

  // RSVPSettings resets its local state whenever the `event` prop identity
  // changes, so this must stay referentially stable across renders that
  // don't actually change event/orgRsvpPage — otherwise every keystroke
  // elsewhere in the builder would wipe unsaved settings edits.
  const settingsEvent = useMemo(
    () => (event ? { ...event, rsvpPage: orgRsvpPage || {} } : null),
    [event, orgRsvpPage]
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a12] text-white/60"><Loader2 className="animate-spin" /></div>;
  }
  if (!config) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a12] text-white/60">Couldn't load this event's RSVP page.</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white flex flex-col">
      {/* header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <button onClick={() => navigate(-1)} className="opacity-70 hover:opacity-100"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <p className="text-sm font-semibold">{event?.title || 'RSVP Page Builder'}</p>
        </div>
        <SaveIndicator state={saveState} />
        <div className="flex rounded-full bg-white/5 p-0.5">
          <button onClick={() => setActiveTab('design')} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeTab === 'design' ? 'bg-white/15' : 'opacity-50 hover:opacity-80'}`}>Design</button>
          <button onClick={() => setActiveTab('settings')} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeTab === 'settings' ? 'bg-white/15' : 'opacity-50 hover:opacity-80'}`}>Settings</button>
        </div>
        {activeTab === 'design' && (
          <div className="flex rounded-full bg-white/5 p-0.5">
            <button onClick={() => setViewMode('desktop')} className={`p-1.5 rounded-full ${viewMode === 'desktop' ? 'bg-white/15' : 'opacity-50'}`}><Monitor size={14} /></button>
            <button onClick={() => setViewMode('mobile')} className={`p-1.5 rounded-full ${viewMode === 'mobile' ? 'bg-white/15' : 'opacity-50'}`}><Smartphone size={14} /></button>
          </div>
        )}
        <a href={`/rsvp/${event?.subdomain || eventId}`} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 opacity-70 hover:opacity-100">
          View live <ExternalLink size={12} />
        </a>
      </div>

      {activeTab === 'design' && (
      <div className="flex flex-1 overflow-hidden">
        {/* left rail */}
        <div className="w-[380px] shrink-0 border-r border-white/10 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs opacity-60">Accent</span>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => updateConfig((prev) => ({ ...prev, accentColor: c }))}
                className="w-5 h-5 rounded-full border-2"
                style={{ background: c, borderColor: config.accentColor === c ? '#fff' : 'transparent' }}
              />
            ))}
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={bodySections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {bodySections.map((section) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    isFixed={false}
                    expanded={expandedId === section.id}
                    onToggleExpand={() => setExpandedId(expandedId === section.id ? null : section.id)}
                    onChangeLayout={(layout) => patchSection(section.id, { layout })}
                    onChangeStyle={(style) => patchSection(section.id, { style })}
                    onChangeContent={(content) => patchSection(section.id, { content })}
                    onDelete={() => deleteSection(section.id)}
                    eventId={eventId}
                    coverProps={{
                      coverTemplates,
                      accentColor: config.accentColor,
                      coverPreviewUrl: coverUrlsById[section.content?.coverImageId],
                      generating: coverGenerating,
                      onGenerate: (template) => handleGenerateCover(section.id, template),
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="relative">
            <button
              onClick={() => setAddMenuOpen((o) => !o)}
              className="w-full flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg border border-dashed border-white/20 hover:border-white/40 opacity-80 hover:opacity-100"
            >
              <Plus size={14} /> Add block
            </button>
            {addMenuOpen && (
              <div className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-[#141420] shadow-xl">
                {BLOCK_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => addSection(type)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                  >
                    {BLOCK_LABELS[type]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* fixed rsvpForm — pinned, no handle, no delete */}
          {fixedSection && (
            <>
              <SectionCard
                section={fixedSection}
                isFixed
                expanded={expandedId === FIXED_ID}
                onToggleExpand={() => setExpandedId(expandedId === FIXED_ID ? null : FIXED_ID)}
                onChangeLayout={() => {}}
                onChangeStyle={(style) => patchSection(FIXED_ID, { style })}
                onChangeContent={() => {}}
                onDelete={() => {}}
                eventId={eventId}
                coverProps={null}
              />
              {seatingMapEnabled && (
                <p className="text-[11px] opacity-50 px-1">
                  This event's seating chart is enabled — guests who RSVP "yes" will also see a table picker here.
                </p>
              )}
            </>
          )}
        </div>

        {/* right: live preview */}
        <div className="flex-1 overflow-y-auto bg-black/30 flex justify-center py-8 px-4">
          <div className={viewMode === 'mobile' ? 'w-[390px]' : 'w-full max-w-4xl'} style={{ transition: 'width 200ms ease' }}>
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <RSVPPageRenderer
                config={previewConfig}
                pageData={null}
                backgroundStyle={flatSettings.backgroundStyle || 'dark'}
                fontStyle={flatSettings.fontStyle || 'modern'}
                coverUrlsById={coverUrlsById}
              />
            </div>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'settings' && (
        <div className="flex-1 overflow-y-auto bg-neutral-100">
          <div className="max-w-3xl mx-auto px-4 py-8">
            {settingsEvent ? (
              <RSVPSettings
                event={settingsEvent}
                eventId={eventId}
                onSettingsChanged={refreshSettings}
              />
            ) : (
              <div className="flex items-center justify-center py-16 text-neutral-500">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
