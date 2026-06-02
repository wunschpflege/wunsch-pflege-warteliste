'use client';

import { useState, useTransition } from 'react';

export default function DeleteButton({
  action, label = 'Löschen', confirmText = 'Diesen Datensatz wirklich endgültig löschen?',
}: { action: () => Promise<void>; label?: string; confirmText?: string }) {
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return <button type="button" className="btn-ghost text-red-600" onClick={() => setArmed(true)}>{label}</button>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm text-red-600">{confirmText}</span>
      <button type="button" className="btn-danger" disabled={pending} onClick={() => start(() => action())}>
        {pending ? '…' : 'Ja, löschen'}
      </button>
      <button type="button" className="btn-ghost" onClick={() => setArmed(false)}>Abbrechen</button>
    </span>
  );
}
