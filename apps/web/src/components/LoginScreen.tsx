import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Command, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { EmailAuthForm } from './EmailAuthForm';

interface GoogleIdentity {
  initialize(config: {
    client_id: string;
    nonce: string;
    callback: (response: { credential: string }) => void;
    auto_select: boolean;
  }): void;
  renderButton(
    element: HTMLElement,
    options: { theme: string; size: string; text: string; shape: string },
  ): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}
let scriptPromise: Promise<GoogleIdentity> | undefined;
function loadGoogle() {
  if (window.google) return Promise.resolve(window.google.accounts.id);
  scriptPromise ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () =>
      window.google
        ? resolve(window.google.accounts.id)
        : reject(new Error('Google sign-in could not load.'));
    script.onerror = () =>
      reject(new Error('Google sign-in could not load. Check your connection and reload.'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}
function GoogleButton({ clientId, nonce }: { clientId: string; nonce: string }) {
  const ref = useRef<HTMLDivElement>(null),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    loadGoogle()
      .then((google) => {
        if (!active || !ref.current) return;
        google.initialize({
          client_id: clientId,
          nonce,
          auto_select: false,
          callback: async (response) => {
            if (!active) return;
            setPending(true);
            setError('');
            try {
              await api('/auth/google', { credential: response.credential });
              window.location.reload();
            } catch (err) {
              if (active) {
                setError((err as Error).message);
                setPending(false);
              }
            }
          },
        });
        google.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
        });
      })
      .catch((err) => {
        if (active) setError((err as Error).message);
      });
    return () => {
      active = false;
      ref.current?.replaceChildren();
    };
  }, [clientId, nonce]);
  return (
    <>
      <div
        ref={ref}
        className="google-signin-button"
        aria-label="Continue with Google"
        aria-busy={pending}
      />
      {pending && <p role="status">Signing you in...</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
export function LoginScreen() {
  const config = useQuery({
    queryKey: ['auth-config'],
    queryFn: () =>
      api<{
        provider: string;
        configured: boolean;
        clientId: string | null;
        origin: string;
        emailEnabled: boolean;
        localEmailPreview: boolean;
      }>('/auth/config'),
    retry: false,
  });
  const correctOrigin = !!config.data && window.location.origin === config.data.origin;
  const challenge = useQuery({
    queryKey: ['auth-challenge'],
    queryFn: () => api<{ nonce: string }>('/auth/challenge', {}),
    enabled: !!config.data?.configured && correctOrigin,
    staleTime: 9 * 60000,
    retry: false,
  });
  return (
    <div className="login-page">
      <section className="login-panel">
        <span className="login-brand">
          <Command size={26} />
          devtrack.
        </span>
        <span className="eyebrow">YOUR PRIVATE LEARNING WORKSPACE</span>
        <h1>
          Your next chapter
          <br />
          starts with you.
        </h1>
        <p>Sign in to pick up your learning, practice and revision where you left off.</p>
        {config.isPending ? (
          <p role="status">Preparing secure sign-in...</p>
        ) : config.error ? (
          <p className="form-error" role="alert">
            {config.error.message}
          </p>
        ) : !correctOrigin ? (
          <Button asChild>
            <a href={config.data!.origin}>Open sign-in on the configured domain</a>
          </Button>
        ) : config.data?.provider === 'access' ? (
          <Button asChild>
            <a href={`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/me`}>
              Sign in through Cloudflare Access
            </a>
          </Button>
        ) : config.data?.emailEnabled ? (
          <EmailAuthForm
            key={
              window.location.hash.includes('reset-password')
                ? 'reset'
                : window.location.hash.includes('verify-email')
                  ? 'verify'
                  : 'email'
            }
            preview={config.data.localEmailPreview}
            google={
              config.data.configured && challenge.data ? (
                <GoogleButton clientId={config.data.clientId!} nonce={challenge.data.nonce} />
              ) : undefined
            }
          />
        ) : !config.data?.configured ? (
          <div className="callout">
            <strong>Google sign-in setup pending</strong>
            <p>
              Add your Google OAuth Web Client ID and allowed account to the API configuration. Your
              workspace stays private until setup is complete.
            </p>
          </div>
        ) : challenge.error ? (
          <p className="form-error" role="alert">
            {challenge.error.message}
          </p>
        ) : challenge.data ? (
          <GoogleButton clientId={config.data.clientId!} nonce={challenge.data.nonce} />
        ) : (
          <p role="status">Connecting to Google sign-in...</p>
        )}
        <div className="login-privacy">
          <ShieldCheck size={16} />
          <span>Your progress and notes are private to your account.</span>
        </div>
        <Button variant="ghost" onClick={() => window.location.reload()}>
          Reload sign-in
        </Button>
      </section>
      <span className="login-footer">Learn. Recall. Build. Repeat.</span>
    </div>
  );
}
