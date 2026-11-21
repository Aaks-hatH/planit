import { useState, useEffect, useCallback } from 'react';
import { loadSettings, saveSettings } from '../utils/doorCount';

/** Door Count settings, kept in this browser only. Saved shortly after the last change. */
export default function useDoorSettings() {
  const [settings, setSettings] = useState(loadSettings);
  const patch = useCallback((p) => setSettings((s) => ({ ...s, ...p })), []);
  useEffect(() => {
    const id = setTimeout(() => saveSettings(settings), 300);
    return () => clearTimeout(id);
  }, [settings]);
  return [settings, patch];
}
