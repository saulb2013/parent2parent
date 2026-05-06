import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_SDK_URL = 'https://accounts.google.com/gsi/client';

function loadGoogleScript() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (window.__googleSdkLoading) return window.__googleSdkLoading;

  window.__googleSdkLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = GOOGLE_SDK_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return window.__googleSdkLoading;
}

export default function GoogleSignInButton({ onSuccess, onError }) {
  const containerRef = useRef(null);
  const { refreshUser } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!GOOGLE_CLIENT_ID) {
    // Misconfigured environment — render nothing rather than a broken button
    return null;
  }

  useEffect(() => {
    let cancelled = false;

    async function handleCredentialResponse(response) {
      if (!response?.credential) return;
      setBusy(true);
      setError('');
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ credential: response.credential }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Sign-in failed');
        await refreshUser();
        if (onSuccess) onSuccess(data.user);
      } catch (err) {
        setError(err.message);
        if (onError) onError(err);
      } finally {
        setBusy(false);
      }
    }

    loadGoogleScript()
      .then(google => {
        if (cancelled || !google || !containerRef.current) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });
        google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          width: containerRef.current.offsetWidth || 320,
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
        });
      })
      .catch(() => {
        if (!cancelled) setError('Could not load Google sign-in');
      });

    return () => { cancelled = true; };
  }, [onSuccess, onError, refreshUser]);

  return (
    <div className="w-full">
      <div ref={containerRef} className={busy ? 'opacity-50 pointer-events-none' : ''} />
      {error && <p className="text-xs text-red-600 mt-2 text-center">{error}</p>}
    </div>
  );
}
