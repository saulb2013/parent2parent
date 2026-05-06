import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function TermsAcceptanceModal() {
  const { refreshUser, logout } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    if (!agreed) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/accept-terms', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to record acceptance');
      }
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-gray-900 mb-3">
          We've updated our policies
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          To keep using Parent2Parent, please review and agree to our updated{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">
            Terms of Use
          </a>{' '}
          and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">
            Privacy Policy
          </a>.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed mb-5">
          Both open in a new tab. We've recently registered as Parent2Parent (Pty) Ltd and clarified
          how we operate Buyer Protection, handle disputes, and process your information under POPIA.
          You don't need to read every word — but it's worth a glance.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>
        )}

        <label className="flex items-start gap-3 cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            className="w-5 h-5 mt-0.5 text-primary rounded focus:ring-primary shrink-0"
          />
          <span className="text-sm text-gray-700">
            I agree to the Terms of Use and Privacy Policy.
          </span>
        </label>

        <button
          onClick={handleAccept}
          disabled={!agreed || submitting}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving...' : 'Continue'}
        </button>

        <button
          onClick={logout}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4 transition-colors"
        >
          Or log out
        </button>
      </div>
    </div>
  );
}
