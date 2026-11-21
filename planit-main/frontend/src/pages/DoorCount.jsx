import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, DoorOpen, FlaskConical, ListChecks, Users, Target } from 'lucide-react';
import { BetaBar } from '../components/BetaBar';
import LabLanding from '../components/LabLanding';
import DoorCountPreview from '../components/DoorCountPreview';
import DoorCountLive from '../components/DoorCountLive';
import DoorCountLab from '../components/DoorCountLab';
import DoorCountShare from '../components/DoorCountShare';
import useDoorSettings from '../hooks/useDoorSettings';
import { ACCENT } from '../utils/doorCountDraw';

const TABS = [{ id: 'count', label: 'Count' }, { id: 'lab', label: 'Accuracy lab' }];

export default function DoorCount() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('landing'); // landing | tool
  const [tab, setTab] = useState('count');
  const [settings, patch] = useDoorSettings();
  const perfRef = useRef(null);                // live fps and inference, read by the share card
  const [labResult, setLabResult] = useState(null);
  const onResult = useCallback((r) => setLabResult(r), []);

  const open = (t) => { setTab(t); setMode('tool'); };

  return (
    <div className="min-h-screen bg-[#05050f] text-white" style={{ paddingTop: 'var(--safe-top, 0px)', paddingBottom: 'var(--safe-bottom, 0px)' }}>
      <BetaBar
        featureId="door-count"
        title="BETA DEMO: on-device headcount, measure it before you rely on it"
        description={
          <>
            Door Count detects people in your camera view on this device and counts them crossing a line. Crowds,
            overlapping people, low light and steep angles reduce accuracy, and it counts bodies, not identities. Video
            is never uploaded or recorded. The Accuracy Lab exists so you can measure how well it does at your own door
            before trusting it. If something breaks we may collect error details (what went wrong, device and browser
            info), never video, counts or images.
          </>
        }
      />
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/[0.06]">
        <button
          onClick={() => (mode === 'tool' ? setMode('landing') : navigate('/'))}
          className="flex items-center gap-2 text-neutral-400 hover:text-white text-sm -ml-2 px-2 min-h-[44px] rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />Back
        </button>
        <div className="flex items-center gap-2 font-display font-bold tracking-tight text-sm">
          <DoorOpen className="w-4 h-4" style={{ color: ACCENT }} />Door Count
        </div>
        <div className="w-16" />
      </div>

      {mode === 'landing' ? (
        <LabLanding
          accent={ACCENT}
          headline={<>Headcount you<br />can measure, on<br />your own door.</>}
          body="On your own device. Count people through a doorway with a phone camera, then label a short clip of your own door and let the app replay it with different settings, so you see how accurate each one really was."
          primary={{ label: 'Set up the door', icon: DoorOpen, onClick: () => open('count') }}
          secondary={{ label: 'Test your accuracy', icon: FlaskConical, onClick: () => open('lab') }}
          footnote="Nothing leaves your device"
          preview={<DoorCountPreview />}
          steps={[
            { title: 'Set up', body: 'Point the camera at the door and place the counting line. A live checklist scores the view: light, size, blur, glare, and where the line sits.', icon: ListChecks },
            { title: 'Count', body: 'People are detected on this device and counted as they cross. Use one line, or a two-line gate that counts only when both lines are crossed in order.', icon: Users },
            { title: 'Test your accuracy', body: 'Label the real crossings on a short clip. The app replays it with each setting and shows precision, recall and delay, measured on your door.', icon: Target },
          ]}
          notes={[
            'Crowds and overlapping people cause undercounts.',
            'Low light and steep camera angles hurt accuracy.',
            'It counts bodies, not identities. The same person leaving and returning is counted each time.',
            'Test at the real door before relying on it. Accuracy numbers appear only after you measure them on your own clip.',
            'The detection library loads from a CDN each time, so this needs a connection to start. The model is kept on your device after the first load.',
          ]}
        />
      ) : (
        <>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
            <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 max-w-md">
              {TABS.map((t) => (
                <button
                  key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                  className={`min-h-[44px] rounded-lg text-sm font-semibold ${tab === t.id ? 'text-[#05050f]' : 'text-neutral-400'}`}
                  style={tab === t.id ? { background: ACCENT } : undefined}
                >{t.label}</button>
              ))}
            </div>
          </div>
          {tab === 'count'
            ? <DoorCountLive settings={settings} patch={patch} perfRef={perfRef} />
            : <DoorCountLab settings={settings} patch={patch} onResult={onResult} />}
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
            <DoorCountShare settings={settings} perfRef={perfRef} labResult={labResult} />
          </div>
        </>
      )}
    </div>
  );
}
