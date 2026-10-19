import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from './ui/button';
type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';
export function EmailAuthForm({
  preview,
  google,
  singleUser = false,
}: {
  preview: boolean;
  google?: React.ReactNode;
  singleUser?: boolean;
}) {
  const location = useLocation();
  const linkedMode: Mode | undefined =
    location.pathname === '/reset-password'
      ? 'reset'
      : location.pathname === '/verify-email'
        ? 'verify'
        : undefined;
  const [selected, setSelected] = useState<Mode>('login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [links, setLinks] = useState<{ purpose: string; link: string }[]>([]);
  const mode = singleUser ? 'login' : (linkedMode ?? selected),
    token = new URLSearchParams(location.search).get('token');
  const labels = {
    login: 'Sign in',
    register: 'Create your account',
    forgot: 'Forgot password?',
    reset: 'Choose a new password',
    verify: 'Verify your email',
  };
  const switchMode = (next: Mode) => {
    setSelected(next);
    setError('');
    setMessage('');
    setPassword('');
    setConfirm('');
    setLinks([]);
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if ((mode === 'register' || mode === 'reset') && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if ((mode === 'reset' || mode === 'verify') && !token) {
      setError('This email link is incomplete. Request a new link.');
      return;
    }
    setPending(true);
    try {
      const body =
        mode === 'reset'
          ? { token, password }
          : mode === 'verify'
            ? { token }
            : mode === 'forgot'
              ? { email }
              : singleUser
                ? { username: email, password }
                : { email, password };
      const path = {
        login: 'login',
        register: 'register',
        forgot: 'forgot-password',
        reset: 'reset-password',
        verify: 'verify-email',
      }[mode];
      const result = await api<{ message?: string }>(`/auth/${path}`, body);
      if (mode === 'login') {
        window.location.reload();
        return;
      }
      setMessage(
        preview && (mode === 'forgot' || mode === 'register')
          ? 'Local email preview is enabled. No message was sent to Gmail. If a link was generated, it appears in the preview below.'
          : (result.message ?? 'Saved.'),
      );
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="email-auth">
      <h2>{labels[mode]}</h2>
      {mode === 'forgot' && (
        <p className="muted">
          Enter your registered email address. We will send a link to choose a new password.
        </p>
      )}
      {mode === 'verify' && (
        <p className="muted">Confirm this email address to finish creating your account.</p>
      )}
      <form className="stack-form" onSubmit={submit}>
        {['login', 'register', 'forgot'].includes(mode) && (
          <label>
            {singleUser ? 'Username' : 'Email address'}
            <input
              name={singleUser ? 'username' : 'email'}
              type={singleUser ? 'text' : 'email'}
              autoComplete={singleUser ? 'username' : 'email'}
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={singleUser ? 'Your username' : 'you@gmail.com'}
            />
          </label>
        )}
        {['login', 'register', 'reset'].includes(mode) && (
          <label>
            <span id="account-password-label">
              {mode === 'reset' ? 'New password' : 'Password'}
            </span>
            <input
              name="password"
              aria-labelledby="account-password-label"
              aria-describedby={mode === 'login' ? undefined : 'account-password-help'}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'login' ? 1 : 12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode !== 'login' && (
              <small id="account-password-help" className="muted">
                Use at least 12 characters. A longer passphrase works well.
              </small>
            )}
          </label>
        )}
        {(mode === 'register' || mode === 'reset') && (
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="form-success" role="status">
            {message}
          </p>
        )}
        <Button
          disabled={pending || (!!message && (mode === 'reset' || mode === 'verify'))}
          type="submit"
        >
          {pending
            ? 'Please wait...'
            : mode === 'forgot'
              ? 'Send reset link'
              : mode === 'reset'
                ? 'Update password'
                : mode === 'verify'
                  ? 'Verify email'
                  : labels[mode]}
        </Button>
      </form>
      {preview && message && ['register', 'forgot'].includes(mode) && (
        <div className="local-mail-preview">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const data = await api<{ messages: { purpose: string; link: string }[] }>(
                  '/auth/dev-mail',
                  { email },
                );
                setLinks(data.messages);
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            Open local email preview
          </Button>
          {links.map((link) => (
            <Link className="list-row" to={new URL(link.link).hash.slice(1)} key={link.link}>
              {link.purpose === 'verify' ? 'Verify email address' : 'Reset password'} &rarr;
            </Link>
          ))}
        </div>
      )}
      {mode === 'login' && !singleUser && (
        <div className="auth-form-links">
          <button onClick={() => switchMode('forgot')}>Forgot password?</button>
          <button onClick={() => switchMode('register')}>Create an account</button>
        </div>
      )}
      {!linkedMode && mode !== 'login' && (
        <button className="text-button" onClick={() => switchMode('login')}>
          Back to sign in
        </button>
      )}
      {linkedMode && (
        <Link className="back-link" to="/">
          Back to sign in
        </Link>
      )}
      {mode === 'login' && google && (
        <div className="auth-alternative">
          <span>or continue with Google</span>
          {google}
        </div>
      )}
    </div>
  );
}
