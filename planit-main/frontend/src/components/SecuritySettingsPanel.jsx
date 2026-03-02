import { useState, useEffect } from 'react';
import {
  Shield, ShieldCheck, ShieldAlert, Lock, Users, Clock, 
  AlertTriangle, Settings, Save, RefreshCw, Info, X,
  Plus, Trash2, Key, History, Eye, EyeOff, UserPlus, Loader2
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

/**
 * Security Settings Configuration Panel
 * Allows organizers to configure all anti-fraud features, manage staff, and view audit logs.
 */
export default function SecuritySettingsPanel({ eventId, onClose, onSettingsUpdated, userRole }) {
  const [settings, setSettings] = useState(null);
  const [originalSettings, setOriginalSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Staff state
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [staffSaving, setStaffSaving] = useState(false);
  const [resetPinFor, setResetPinFor] = useState(null);
  const [resetPinValue, setResetPinValue] = useState('');

  // Audit state
  const [overrideHistory, setOverrideHistory] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const isOrganizer = userRole === 'organizer';

  const hasUnsavedChanges = settings && originalSettings &&
    JSON.stringify(settings) !== JSON.stringify(originalSettings);

  useEffect(() => {
    loadSettings();
    if (isOrganizer) loadStaff();
  }, [eventId, isOrganizer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'audit' && isOrganizer) loadOverrideHistory();
    if (activeTab === 'staff' && isOrganizer) loadStaff();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await eventAPI.getCheckInSettings(eventId);
      const s = response.data.settings || response.data || {};
      setSettings(s);
      setOriginalSettings(JSON.parse(JSON.stringify(s)));
    } catch (error) {
      console.error('Failed to load security settings:', error);
      toast.error('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    try {
      setStaffLoading(true);
      const response = await eventAPI.getStaff(eventId);
      setStaff(response.data.staff || []);
    } catch (error) {
      console.error('Failed to load staff:', error);
    } finally {
      setStaffLoading(false);
    }
  };

  const loadOverrideHistory = async () => {
    try {
      setAuditLoading(true);
      const response = await eventAPI.getOverrideHistory(eventId);
      setOverrideHistory(response.data.overrides || []);
    } catch (error) {
      console.error('Failed to load override history:', error);
    } finally {
      setAuditLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await eventAPI.updateCheckInSettings(eventId, settings);
      setOriginalSettings(JSON.parse(JSON.stringify(settings)));
      toast.success('Security settings saved successfully');
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    onClose();
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newStaffUsername.trim()) { toast.error('Username required'); return; }
    if (!newStaffPin || newStaffPin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
    if (!/^\d+$/.test(newStaffPin)) { toast.error('PIN must be numbers only'); return; }

    setStaffSaving(true);
    try {
      await eventAPI.createStaff(eventId, { username: newStaffUsername.trim(), pin: newStaffPin });
      toast.success(`Staff account "${newStaffUsername}" created`);
      setNewStaffUsername('');
      setNewStaffPin('');
      await loadStaff();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create staff account');
    } finally {
      setStaffSaving(false);
    }
  };

  const handleDeleteStaff = async (username) => {
    if (!window.confirm(`Remove staff account "${username}"?`)) return;
    try {
      await eventAPI.deleteStaff(eventId, username);
      toast.success('Staff account removed');
      loadStaff();
    } catch (error) {
      toast.error('Failed to remove staff account');
    }
  };

  const handleResetPin = async (username) => {
    if (!resetPinValue || resetPinValue.length < 4 || !/^\d+$/.test(resetPinValue)) {
      toast.error('PIN must be 4+ digits'); return;
    }
    try {
      await eventAPI.updateStaffPin(eventId, username, resetPinValue);
      toast.success('PIN updated');
      setResetPinFor(null);
      setResetPinValue('');
    } catch (error) {
      toast.error('Failed to update PIN');
    }
  };

  const getPresetConfig = (preset) => {
    const presets = {
      maximum: {
        requirePin: true,
        blockCrossEvent: true,
        maxFailedAttempts: 2,
        lockoutMinutes: 30,
        allowManualOverride: false,
        detailedAuditLogging: true,
        logIPAddresses: true,
        staffNote: 'STRICT MODE: Verify all credentials carefully.',
        enableDuplicateDetection: true,
        autoBlockDuplicates: true,
        allowMultipleTickets: false,
        enablePatternDetection: true,
        rapidScanThreshold: 3,
        rapidScanWindowSeconds: 10,
        multiDeviceThreshold: 3,
        enableTrustScore: true,
        minimumTrustScore: 80,
        autoBlockLowTrust: true,
        enableReentrancyProtection: true,
        enableCapacityLimits: false,
      },
      balanced: {
        requirePin: false,
        blockCrossEvent: true,
        maxFailedAttempts: 3,
        lockoutMinutes: 15,
        allowManualOverride: true,
        detailedAuditLogging: true,
        logIPAddresses: true,
        staffNote: 'Standard security. Use manager override when necessary.',
        enableDuplicateDetection: true,
        autoBlockDuplicates: false,
        allowMultipleTickets: false,
        enablePatternDetection: true,
        rapidScanThreshold: 5,
        rapidScanWindowSeconds: 15,
        multiDeviceThreshold: 4,
        enableTrustScore: true,
        minimumTrustScore: 60,
        autoBlockLowTrust: false,
        enableReentrancyProtection: true,
      },
      minimal: {
        requirePin: false,
        blockCrossEvent: true,
        maxFailedAttempts: 5,
        lockoutMinutes: 10,
        allowManualOverride: true,
        detailedAuditLogging: false,
        staffNote: 'Relaxed checking for casual events.',
        enableDuplicateDetection: false,
        enablePatternDetection: false,
        enableTrustScore: false,
        enableReentrancyProtection: false,
      },
    };
    return presets[preset];
  };

  const applyPreset = (preset) => {
    const presetConfig = getPresetConfig(preset);
    setSettings(prev => ({ ...prev, ...presetConfig }));
    toast.success(`Applied ${preset} security preset`);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-neutral-600 text-center">Loading settings...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'duplicate', label: 'Duplicates', icon: Users },
    { id: 'patterns', label: 'Patterns', icon: AlertTriangle },
    { id: 'advanced', label: 'Advanced', icon: Lock },
    ...(isOrganizer ? [
      { id: 'staff', label: 'Staff', icon: UserPlus },
      { id: 'audit', label: 'Audit', icon: History },
    ] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={handleClose}>
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl my-8" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl p-6 text-white sticky top-0 z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-black">Security Settings</h1>
                {hasUnsavedChanges && (
                  <span className="text-xs bg-yellow-400 text-yellow-900 font-bold px-2 py-0.5 rounded ml-2">
                    Unsaved changes
                  </span>
                )}
              </div>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-blue-100">Configure anti-fraud protection and manage check-in staff</p>
        </div>

        <div className="p-6">
          {/* Quick Presets — only show on security tabs */}
          {['general','duplicate','patterns','advanced'].includes(activeTab) && isOrganizer && (
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Quick Security Presets
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={() => applyPreset('maximum')} className="p-4 border-2 border-red-300 rounded-xl hover:bg-red-50 transition-all text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="w-5 h-5 text-red-600" />
                    <span className="font-bold text-red-900">Maximum Security</span>
                  </div>
                  <p className="text-sm text-neutral-600">Strictest fraud prevention. Best for high-security events.</p>
                </button>
                <button onClick={() => applyPreset('balanced')} className="p-4 border-2 border-blue-300 rounded-xl hover:bg-blue-50 transition-all text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-blue-900">Balanced</span>
                  </div>
                  <p className="text-sm text-neutral-600">Good security with flexibility. Recommended for most events.</p>
                </button>
                <button onClick={() => applyPreset('minimal')} className="p-4 border-2 border-green-300 rounded-xl hover:bg-green-50 transition-all text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    <span className="font-bold text-green-900">Minimal</span>
                  </div>
                  <p className="text-sm text-neutral-600">Basic protection. Best for casual, low-risk events.</p>
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-neutral-200 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm transition-all whitespace-nowrap ${
                  activeTab === id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Settings Content */}
          {activeTab !== 'staff' && activeTab !== 'audit' && (
            <div className="bg-neutral-50 rounded-2xl p-6 mb-6">
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold mb-4">General Security</h3>
                  <ToggleSetting label="Require Security PIN" description="Guests must provide a PIN code to check in" value={settings.requirePin || false} onChange={(v) => updateSetting('requirePin', v)} />
                  <ToggleSetting label="Block Cross-Event Tickets" description="Prevent tickets from other events (HIGHLY RECOMMENDED)" value={settings.blockCrossEvent !== false} onChange={(v) => updateSetting('blockCrossEvent', v)} recommended />
                  <NumberSetting label="Maximum Failed Attempts" description="Lock ticket after this many failed PIN attempts" value={settings.maxFailedAttempts || 3} onChange={(v) => updateSetting('maxFailedAttempts', v)} min={1} max={10} />
                  <NumberSetting label="Lockout Duration (minutes)" description="How long to lock ticket after failed attempts" value={settings.lockoutMinutes || 15} onChange={(v) => updateSetting('lockoutMinutes', v)} min={5} max={120} />
                  <ToggleSetting label="Allow Manual Override" description="Staff can override blocks with manager approval" value={settings.allowManualOverride !== false} onChange={(v) => updateSetting('allowManualOverride', v)} />
                  <TextAreaSetting label="Staff Instructions" description="Special instructions shown to security staff" value={settings.staffNote || ''} onChange={(v) => updateSetting('staffNote', v)} placeholder="E.g., Check all IDs, verify group size matches ticket..." />
                </div>
              )}
              {activeTab === 'duplicate' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold mb-4">Duplicate Detection</h3>
                  <ToggleSetting label="Enable Duplicate Detection" description="Detect same person with multiple tickets" value={settings.enableDuplicateDetection || false} onChange={(v) => updateSetting('enableDuplicateDetection', v)} recommended />
                  <SelectSetting label="Detection Mode" description="How strictly to match guest identities" value={settings.duplicateDetectionMode || 'moderate'} onChange={(v) => updateSetting('duplicateDetectionMode', v)} options={[{value:'strict',label:'Strict - Name + Email + Phone'},{value:'moderate',label:'Moderate - Name + (Email OR Phone)'},{value:'lenient',label:'Lenient - Name only'}]} />
                  <ToggleSetting label="Auto-Block Duplicates" description="Automatically block duplicate check-in attempts" value={settings.autoBlockDuplicates || false} onChange={(v) => updateSetting('autoBlockDuplicates', v)} />
                  <ToggleSetting label="Allow Multiple Tickets Per Person" description="Same person can have multiple valid tickets" value={settings.allowMultipleTickets || false} onChange={(v) => updateSetting('allowMultipleTickets', v)} />
                </div>
              )}
              {activeTab === 'patterns' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold mb-4">Suspicious Pattern Detection</h3>
                  <ToggleSetting label="Enable Pattern Detection" description="Detect suspicious scanning behaviors" value={settings.enablePatternDetection || false} onChange={(v) => updateSetting('enablePatternDetection', v)} recommended />
                  <NumberSetting label="Rapid Scan Threshold" description="Flag after this many scans in time window" value={settings.rapidScanThreshold || 3} onChange={(v) => updateSetting('rapidScanThreshold', v)} min={2} max={10} />
                  <NumberSetting label="Rapid Scan Window (seconds)" description="Time window for rapid scan detection" value={settings.rapidScanWindowSeconds || 10} onChange={(v) => updateSetting('rapidScanWindowSeconds', v)} min={5} max={60} />
                  <ToggleSetting label="Enable Trust Score System" description="Calculate trust scores based on behavior" value={settings.enableTrustScore || false} onChange={(v) => updateSetting('enableTrustScore', v)} />
                  {settings.enableTrustScore && (
                    <>
                      <NumberSetting label="Minimum Trust Score" description="Minimum score required for admission (0-100)" value={settings.minimumTrustScore || 50} onChange={(v) => updateSetting('minimumTrustScore', v)} min={0} max={100} />
                      <ToggleSetting label="Auto-Block Low Trust" description="Automatically block tickets below minimum trust score" value={settings.autoBlockLowTrust || false} onChange={(v) => updateSetting('autoBlockLowTrust', v)} />
                    </>
                  )}
                </div>
              )}
              {activeTab === 'advanced' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold mb-4">Advanced Settings</h3>
                  <ToggleSetting label="Detailed Audit Logging" description="Log all scan attempts and security events" value={settings.detailedAuditLogging !== false} onChange={(v) => updateSetting('detailedAuditLogging', v)} recommended />
                  <ToggleSetting label="Log IP Addresses" description="Record IP addresses of all scan attempts" value={settings.logIPAddresses || false} onChange={(v) => updateSetting('logIPAddresses', v)} />
                  <ToggleSetting label="Log Device Information" description="Record device/browser information" value={settings.logDeviceInfo || false} onChange={(v) => updateSetting('logDeviceInfo', v)} />
                  <ToggleSetting label="Enable Capacity Limits" description="Enforce maximum venue capacity" value={settings.enableCapacityLimits || false} onChange={(v) => updateSetting('enableCapacityLimits', v)} />
                  {settings.enableCapacityLimits && (
                    <NumberSetting label="Maximum Total Attendees" description="Stop check-ins when this capacity is reached" value={settings.maxTotalAttendees || 0} onChange={(v) => updateSetting('maxTotalAttendees', v)} min={1} max={100000} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Staff Tab */}
          {activeTab === 'staff' && isOrganizer && (
            <div className="space-y-6 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Staff Check-in Accounts</p>
                    <p className="text-blue-700">Create PIN-protected accounts for your check-in staff. They log in at the check-in page using their username and PIN — no organizer password needed. Staff can scan tickets and admit guests but cannot change settings or manage invites.</p>
                  </div>
                </div>
              </div>

              {/* Create Staff Form */}
              <div className="bg-white border-2 border-neutral-200 rounded-xl p-5">
                <h3 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Staff Member
                </h3>
                <form onSubmit={handleCreateStaff} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1">Username</label>
                      <input
                        type="text"
                        value={newStaffUsername}
                        onChange={e => setNewStaffUsername(e.target.value)}
                        placeholder="e.g. door-staff-1"
                        className="w-full border-2 border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1">PIN (4–8 digits)</label>
                      <div className="relative">
                        <input
                          type={showNewPin ? 'text' : 'password'}
                          value={newStaffPin}
                          onChange={e => setNewStaffPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          placeholder="e.g. 1234"
                          inputMode="numeric"
                          className="w-full border-2 border-neutral-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:border-blue-500"
                        />
                        <button type="button" onClick={() => setShowNewPin(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                          {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={staffSaving || !newStaffUsername.trim() || newStaffPin.length < 4}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {staffSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Create Staff Account
                  </button>
                </form>
              </div>

              {/* Staff List */}
              <div className="bg-white border-2 border-neutral-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-neutral-900">Staff Accounts ({staff.length})</h3>
                  {staffLoading && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
                </div>
                {staff.length === 0 ? (
                  <div className="text-center py-8 text-neutral-400 text-sm">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No staff accounts yet
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {staff.map(member => (
                      <div key={member.username} className="px-5 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                          {member.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-neutral-900">{member.username}</p>
                          <p className="text-xs text-neutral-400">
                            Created {new Date(member.createdAt).toLocaleDateString()}
                            {member.lastSeenAt && ` · Last seen ${new Date(member.lastSeenAt).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {resetPinFor === member.username ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="password"
                                value={resetPinValue}
                                onChange={e => setResetPinValue(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                placeholder="New PIN"
                                inputMode="numeric"
                                className="w-24 border border-neutral-200 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                                maxLength={8}
                              />
                              <button onClick={() => handleResetPin(member.username)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">Save</button>
                              <button onClick={() => { setResetPinFor(null); setResetPinValue(''); }} className="text-xs px-2 py-1 bg-neutral-100 text-neutral-600 rounded-lg font-semibold hover:bg-neutral-200">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setResetPinFor(member.username)}
                              title="Reset PIN"
                              className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteStaff(member.username)}
                            title="Remove staff"
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audit Tab */}
          {activeTab === 'audit' && isOrganizer && (
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-neutral-900">Manager Override Audit Log</h3>
                <button onClick={loadOverrideHistory} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 px-3 py-1.5 border border-neutral-200 rounded-lg">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
              {auditLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">Loading audit log...</p>
                </div>
              ) : overrideHistory.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 text-sm bg-neutral-50 rounded-xl">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No manager overrides have been used yet
                </div>
              ) : (
                <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                  <div className="divide-y divide-neutral-100">
                    {overrideHistory.map((entry, idx) => (
                      <div key={idx} className="p-4 hover:bg-neutral-50 transition-colors">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-bold text-neutral-900 text-sm">{entry.guestName}</span>
                              <span className="font-mono text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">{entry.inviteCode}</span>
                              {entry.originalBlockReason && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-semibold">
                                  {entry.originalBlockReason.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-600 mb-1">
                              <span className="font-semibold">Override by:</span> {entry.overrideBy} · <span className="font-semibold">Staff:</span> {entry.checkedInBy}
                            </p>
                            <p className="text-xs text-neutral-500 bg-neutral-50 rounded px-2 py-1 border border-neutral-100">{entry.overrideReason}</p>
                          </div>
                          <div className="text-right text-xs text-neutral-400 flex-shrink-0">
                            <p className="font-semibold">{new Date(entry.checkedInAt).toLocaleDateString()}</p>
                            <p>{new Date(entry.checkedInAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</p>
                            <p className="mt-1">{entry.actualAttendees} admitted</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Emergency Controls — on security tabs only */}
          {['general','duplicate','patterns','advanced'].includes(activeTab) && isOrganizer && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 mb-6">
              <h3 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Emergency Controls
              </h3>
              <ToggleSetting
                label="EMERGENCY LOCKDOWN"
                description="IMMEDIATELY STOP ALL CHECK-INS"
                value={settings.emergencyLockdown || false}
                onChange={(v) => updateSetting('emergencyLockdown', v)}
                danger
              />
              {settings.emergencyLockdown && (
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-red-900 mb-2">Lockdown Reason</label>
                  <input
                    type="text"
                    value={settings.emergencyLockdownReason || ''}
                    onChange={(e) => updateSetting('emergencyLockdownReason', e.target.value)}
                    placeholder="Reason for emergency lockdown..."
                    className="w-full border-2 border-red-300 rounded-xl px-4 py-2 focus:outline-none focus:border-red-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Save Button — only for settings tabs */}
          {['general','duplicate','patterns','advanced'].includes(activeTab) && isOrganizer && (
            <div className="flex justify-end gap-4">
              <button
                onClick={loadSettings}
                className="px-6 py-3 border-2 border-neutral-300 text-neutral-700 font-semibold rounded-xl hover:bg-neutral-50 transition-all"
              >
                <RefreshCw className="w-4 h-4 inline mr-2" />
                Discard
              </button>
              <button
                onClick={saveSettings}
                disabled={saving || !hasUnsavedChanges}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg"
              >
                {saving ? (
                  <><RefreshCw className="w-4 h-4 inline mr-2 animate-spin" />Saving...</>
                ) : (
                  <><Save className="w-4 h-4 inline mr-2" />{hasUnsavedChanges ? 'Save Changes' : 'Saved'}</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Components
function ToggleSetting({ label, description, value, onChange, recommended, danger }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-neutral-100">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <label className="font-semibold text-neutral-900">{label}</label>
          {recommended && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">RECOMMENDED</span>
          )}
        </div>
        <p className="text-sm text-neutral-600 mt-1">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
          value ? danger ? 'bg-red-600' : 'bg-blue-600' : 'bg-neutral-300'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function NumberSetting({ label, description, value, onChange, min, max }) {
  return (
    <div className="py-3 border-b border-neutral-100">
      <label className="font-semibold text-neutral-900 block mb-1">{label}</label>
      {description && <p className="text-sm text-neutral-600 mb-3">{description}</p>}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        min={min}
        max={max}
        className="w-32 border-2 border-neutral-300 rounded-xl px-4 py-2 font-semibold focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

function SelectSetting({ label, description, value, onChange, options }) {
  return (
    <div className="py-3 border-b border-neutral-100">
      <label className="font-semibold text-neutral-900 block mb-1">{label}</label>
      {description && <p className="text-sm text-neutral-600 mb-3">{description}</p>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-md border-2 border-neutral-300 rounded-xl px-4 py-2 font-semibold focus:outline-none focus:border-blue-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function TextAreaSetting({ label, description, value, onChange, placeholder }) {
  return (
    <div className="py-3 border-b border-neutral-100">
      <label className="font-semibold text-neutral-900 block mb-1">{label}</label>
      {description && <p className="text-sm text-neutral-600 mb-3">{description}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full border-2 border-neutral-300 rounded-xl px-4 py-2 focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}
