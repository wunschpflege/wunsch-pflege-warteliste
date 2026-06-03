'use client';

import { useState } from 'react';

interface Aktivitaet {
  id: string;
  kuerzel: string | null;
  aktion: string;
  entitaet: string;
  details: string | null;
  zeitpunkt: Date;
}

const LIMIT = 5;

export default function AktivitaetenBlock({
  items,
  fmtDateTime,
}: {
  items: Aktivitaet[];
  fmtDateTime: (d: Date) => string;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, LIMIT);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Letzte Aktivitäten</h2>
        {items.length > LIMIT && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-sm text-brand-600 hover:underline"
          >
            {showAll ? 'Weniger anzeigen' : `Alle ${items.length} anzeigen`}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {visible.map((a) => (
          <div key={a.id} className="flex items-start gap-2 text-sm">
            {a.kuerzel && <span className="kuerzel">{a.kuerzel}</span>}
            <div className="min-w-0">
              <p className="truncate">
                {a.aktion} · {a.entitaet}
                {a.details ? ` – ${a.details}` : ''}
              </p>
              <p className="text-xs text-muted">{fmtDateTime(a.zeitpunkt)}</p>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted">Noch keine Aktivitäten.</p>}
      </div>
    </section>
  );
}
