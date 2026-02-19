import { useState } from 'react';
import { Shield, Lock, AlertTriangle, X, CheckCircle, Loader2, Clock } from 'lucide-react';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MANAGER OVERRIDE DIALOG
 * Complete UI for requesting and using manager override authorization
 * ═══════════════════════════════════════════════════════════════════════════
 */

export default function ManagerOverrideDialog({ 
  eventId, 
  invite, 
  blockDetails,
  onOverrideSuccess, 
  onCancel 
}) {
  const [step, setStep] = useState('request'); // 'request', 'authorized', 'executing'
  const [managerUsername, setManagerUsername] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [reason, setReason] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [overrideToken, setOverrideToken] = useState(null);
  const [overrideData, setOverrideData] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Step 1: Request Override Authorization
  const handleRequestOverride = async () => {
    // Validation
    if (!managerUsername.trim()) {
      setError('Manager username is required');
      return;
    }
    if (!managerPassword.trim()) {
      setError('Manager password is required');
      return;
    }
    if (!reason.trim() || reason.trim().length < 10) {
      setError('Please provide a detailed reason (minimum 10 characters)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${API_URL}/events/${eventId}/request-override`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('eventToken')}`,
          },
          body: JSON.stringify({
            managerUsername: managerUsername.trim(),
            managerPassword,
            inviteCode: invite.inviteCode,
            reason: reason.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Override request failed');
      }

      // Success - save token and move to authorized step
      setOverrideToken(data.overrideToken);
      setOverrideData(data);
      setStep('authorized');
      
      // Clear sensitive data
      setManagerPassword('');

    } catch (err) {
      setError(err.message || 'Failed to authorize override');
      console.error('Override request error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Execute Check-in with Override
  const handleExecuteOverride = async () => {
    setLoading(true);
    setError('');
    setStep('executing');

    try {
      const response = await fetch(
        `${API_URL}/events/${eventId}/checkin-with-override/${invite.inviteCode}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('eventToken')}`,
          },
          body: JSON.stringify({
            overrideToken,
            actualAttendees: invite.actualAttendees || invite.groupSize,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Check-in with override failed');
      }

      // Success!
      onOverrideSuccess(data);

    } catch (err) {
      setError(err.message || 'Failed to execute override');
      setStep('authorized'); // Go back to allow retry
      console.error('Override execution error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 to-orange-600 p-6 rounded-t-3xl">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">MANAGER OVERRIDE</h2>
                <p className="text-yellow-100 text-sm font-semibold">
                  Security authorization required
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              disabled={loading}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white disabled:opacity-50"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Block Details */}
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-900 mb-2">Security Block Active</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-700 font-semibold">Guest:</span>
                    <span className="text-red-900 font-bold">{invite.guestName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-700 font-semibold">Invite Code:</span>
                    <span className="text-red-900 font-mono font-bold">{invite.inviteCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-700 font-semibold">Block Reason:</span>
                    <span className="text-red-900 font-bold">
                      {blockDetails?.blockedReason?.replace(/_/g, ' ').toUpperCase() || 
                       blockDetails?.reason?.replace(/_/g, ' ').toUpperCase() ||
                       'SECURITY VIOLATION'}
                    </span>
                  </div>
                  {blockDetails?.message && (
                    <div className="mt-2 pt-2 border-t border-red-300">
                      <p className="text-red-800">{blockDetails.message}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step 1: Request Authorization */}
          {step === 'request' && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Manager Authorization Required</p>
                    <p className="text-blue-700">
                      Only event organizers can authorize security overrides. This action will be logged and audited.
                    </p>
                  </div>
                </div>
              </div>

              {/* Manager Username */}
              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">
                  Manager Username <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={managerUsername}
                  onChange={(e) => {
                    setManagerUsername(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter manager/organizer username"
                  className="w-full border-2 border-neutral-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-blue-500"
                  autoFocus
                  disabled={loading}
                />
              </div>

              {/* Manager Password */}
              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">
                  Manager Password <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={managerPassword}
                    onChange={(e) => {
                      setManagerPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter manager password"
                    className="w-full border-2 border-neutral-300 rounded-xl px-4 py-3 pr-12 text-base focus:outline-none focus:border-blue-500"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <Lock className="w-5 h-5" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Override Reason */}
              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">
                  Override Reason <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setError('');
                  }}
                  placeholder="Provide a detailed reason for this override (minimum 10 characters)&#10;&#10;Examples:&#10;- Guest ID verified, legitimate ticket holder&#10;- Technical issue with system, guest pre-approved&#10;- VIP guest, verbal approval from event director"
                  rows={5}
                  className="w-full border-2 border-neutral-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-blue-500 resize-none"
                  disabled={loading}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  {reason.length} / 10 characters minimum
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                  <p className="text-sm text-red-800 font-semibold">{error}</p>
                </div>
              )}

              {/* Request Button */}
              <button
                onClick={handleRequestOverride}
                disabled={loading || !managerUsername.trim() || !managerPassword.trim() || reason.trim().length < 10}
                className="w-full px-6 py-4 bg-yellow-500 text-yellow-950 text-lg font-black rounded-xl hover:bg-yellow-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying Manager...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Request Override Authorization
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 2: Authorization Granted */}
          {step === 'authorized' && (
            <div className="space-y-4">
              <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-5">
                <div className="flex items-start gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-green-900 mb-1">
                      Override Authorized
                    </h3>
                    <p className="text-sm text-green-700">
                      Manager <span className="font-bold">{overrideData?.managerUsername}</span> has authorized this override.
                    </p>
                  </div>
                </div>

                {/* Override Details */}
                <div className="bg-white rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Authorized By:</span>
                    <span className="font-bold text-neutral-900">{overrideData?.managerUsername}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Reason:</span>
                    <span className="font-semibold text-neutral-900 text-right max-w-xs">
                      {reason}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-600">Token Expires:</span>
                    <span className="font-bold text-orange-600 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {overrideData?.expiresIn ? Math.floor(overrideData.expiresIn / 60) : 5} minutes
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-900">
                    <p className="font-semibold mb-1">This action will be logged</p>
                    <p className="text-yellow-800">
                      The override will be permanently recorded in the audit trail with manager identity, reason, and timestamp.
                    </p>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                  <p className="text-sm text-red-800 font-semibold">{error}</p>
                </div>
              )}

              {/* Execute Button */}
              <button
                onClick={handleExecuteOverride}
                disabled={loading}
                className="w-full px-6 py-4 bg-emerald-600 text-white text-lg font-black rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing Override...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Execute Override & Admit Guest
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 3: Executing */}
          {step === 'executing' && (
            <div className="py-12 text-center">
              <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-xl font-bold text-neutral-900">Processing Override...</p>
              <p className="text-sm text-neutral-600 mt-2">Please wait while we admit the guest</p>
            </div>
          )}
        </div>

        {/* Footer Warning */}
        {step !== 'executing' && (
          <div className="border-t border-neutral-200 px-6 py-4 bg-neutral-50 rounded-b-3xl">
            <p className="text-xs text-neutral-600 text-center">
              <span className="font-bold">Security Notice:</span> Manager overrides bypass automated security checks. 
              Use only when absolutely necessary and with valid justification.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
