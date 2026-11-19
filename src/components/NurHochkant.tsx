'use client';

import { useEffect } from 'react';

// Auf dem Handy nur Hochformat: Wird das Handy quer gehalten, deckt ein Hinweis die Oberflaeche ab.
// Die Seite darunter bleibt unveraendert bestehen (kein Neuladen, keine Eingaben gehen verloren).
// Bewusst NICHT ueber Fenstermasse oder die Media Query (orientation: landscape): Bei offener
// Bildschirmtastatur ist das Fenster auch hochkant breiter als hoch.

const KLASSE = 'nur-hochkant';

function istHandy(): boolean {
  return (
    window.matchMedia('(pointer: coarse)').matches &&
    Math.min(window.screen.width, window.screen.height) <= 540
  );
}

function istQuer(): boolean {
  const o = window.screen.orientation;
  if (o && typeof o.type === 'string') return o.type.startsWith('landscape');
  const winkel = (window as unknown as { orientation?: number }).orientation;
  return typeof winkel === 'number' && Math.abs(winkel) === 90;
}

export default function NurHochkant() {
  useEffect(() => {
    const pruefen = () => {
      document.documentElement.classList.toggle(KLASSE, istHandy() && istQuer());
    };
    pruefen();

    // Wirkt nur bei installierter App (Android); ueberall sonst schlaegt es fehl – das ist in Ordnung.
    try {
      if (istHandy()) {
        const o = window.screen.orientation as unknown as {
          lock?: (richtung: string) => Promise<void>;
        } | undefined;
        const ergebnis = o?.lock?.('portrait');
        if (ergebnis && typeof ergebnis.catch === 'function') ergebnis.catch(() => {});
      }
    } catch {}

    const o = window.screen.orientation;
    window.addEventListener('orientationchange', pruefen);
    window.addEventListener('resize', pruefen);
    o?.addEventListener?.('change', pruefen);
    return () => {
      window.removeEventListener('orientationchange', pruefen);
      window.removeEventListener('resize', pruefen);
      o?.removeEventListener?.('change', pruefen);
      document.documentElement.classList.remove(KLASSE);
    };
  }, []);

  return (
    <div className="nur-hochkant-hinweis" role="alert">
      <svg
        className="nur-hochkant-symbol"
        viewBox="0 0 96 96"
        width="96"
        height="96"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Handy quer (gestrichelt) */}
        <rect x="8" y="56" width="52" height="30" rx="5" strokeDasharray="5 6" opacity="0.45" />
        {/* Handy hochkant */}
        <rect x="52" y="24" width="34" height="62" rx="6" />
        <line x1="65" y1="77" x2="73" y2="77" />
        {/* Drehpfeil */}
        <path d="M16 44 C16 24 28 14 44 14" />
        <path d="M36 6 L45 14 L36 22" />
      </svg>
      <h2 className="nur-hochkant-titel">Bitte das Handy hochkant halten</h2>
      <p className="nur-hochkant-text">
        Dieses Programm ist auf dem Handy für das Hochformat gemacht.
      </p>
    </div>
  );
}
