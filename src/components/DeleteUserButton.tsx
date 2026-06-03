'use client';

import { useActionState } from 'react';
import { deleteUser } from '@/app/(app)/benutzer/actions';

type State = { ok: boolean; error?: string };
const init: State = { ok: false };

export default function DeleteUserButton({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(deleteUser, init);

  if (state.ok) return <span className="text-xs text-green-700 font-medium">Gelöscht ✓</span>;

  return (
    <div className="space-y-1">
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <button className="btn-danger text-xs px-2 py-1" disabled={pending}>
          {pending ? '…' : 'Löschen'}
        </button>
      </form>
      {state.error && (
        <p className="text-xs text-red-600 max-w-xs leading-tight">{state.error}</p>
      )}
    </div>
  );
}
