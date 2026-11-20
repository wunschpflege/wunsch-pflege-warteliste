import { Suspense } from 'react';
import { portalAnmeldeLink } from '@/lib/portal';
import { abgemeldetHinweis, inaktivMinuten } from '@/lib/inaktiv';
import LoginForm from './form';

// Die Einstellung PORTAL_ANMELDUNG_URL wird beim Aufruf gelesen, nicht beim Build
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Gesetzt, wenn die Anmeldung nur noch ueber das Portal laeuft (PORTAL_ANMELDUNG_URL); sonst wie bisher
  const portalLink = portalAnmeldeLink();
  const sp = await searchParams;
  const portalFehler = portalLink !== null && sp.portal === 'fehler';
  // Nach der automatischen Abmeldung (zu lange keine Eingabe)
  const inaktivHinweis = sp.abgemeldet === 'inaktiv' ? abgemeldetHinweis(inaktivMinuten()) : null;

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

        {inaktivHinweis && (
          <p
            role="status"
            data-testid="abgemeldet-hinweis"
            className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-base font-semibold text-amber-900 dark:border-amber-500/50 dark:bg-amber-900/30 dark:text-amber-100"
          >
            {inaktivHinweis}
          </p>
        )}

        {portalLink ? (
          <div className="card p-6 space-y-4">
            <h2 className="text-base font-semibold">Anmeldung für Mitarbeiter</h2>
            <p className="text-sm">
              Die Anmeldung läuft über das Wunsch-Pflege Portal. Eine eigene PIN für die Warteliste ist nicht mehr nötig.
            </p>
            {portalFehler && (
              <p role="alert" className="text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">
                Die Anmeldung über das Portal hat nicht geklappt. Bitte im Portal erneut auf die Warteliste tippen.
                Klappt es wieder nicht, gibt es in der Warteliste vermutlich kein aktives Konto für dich – bitte an
                die Verwaltung wenden.
              </p>
            )}
            <a href={portalLink} className="btn-primary w-full">Über das Portal anmelden</a>
          </div>
        ) : (
          <Suspense fallback={<div className="card p-6 text-center text-muted">Lädt…</div>}>
            <LoginForm />
          </Suspense>
        )}

        <p className="text-xs text-muted text-center mt-4">
          Zugriff nur für autorisierte Mitarbeiter. Alle Aktivitäten werden protokolliert.
        </p>
      </div>
    </main>
  );
}
