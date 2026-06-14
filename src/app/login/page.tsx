'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN muss genau 4 Ziffern enthalten.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Anmeldung fehlgeschlagen.');
        return;
      }
      router.push(params.get('next') || '/dashboard');
      router.refresh();
    } catch {
      setError('Verbindungsfehler. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-4">
      <h2 className="text-base font-semibold">Anmeldung für Mitarbeiter</h2>

      <div>
        <label className="label" htmlFor="username">Benutzername</label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          required
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="m.mustermann"
        />
      </div>
      <div>
        <label className="label" htmlFor="pin">PIN (4 Ziffern)</label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          autoComplete="current-password"
          required
          className="input tracking-[0.5em] text-center text-xl"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="••••"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Anmeldung läuft…' : 'Anmelden'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="h-11 w-11 rounded-xl bg-brand-600 grid place-items-center text-white font-bold text-lg">
            WP
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Wunsch-Pflege GmbH</h1>
            <p className="text-sm text-muted">Wartelistenverwaltung</p>
          </div>
        </div>

        <Suspense fallback={<div className="card p-6 text-center text-muted">Lädt…</div>}>
          <LoginForm />
        </Suspense>

        <p className="text-xs text-muted text-center mt-4">
          Zugriff nur für autorisierte Mitarbeiter. Alle Aktivitäten werden protokolliert.
        </p>
      </div>
    </main>
  );
}
