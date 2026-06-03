'use client';

import { useState } from 'react';
import { STATUS_LABEL } from '@/lib/labels';
import { bulkStatusAendern } from '@/app/(app)/warteliste/actions';

interface Props {
  ids: string[];
}

const statusOptions = Object.entries(STATUS_LABEL) as [string, string][];

export default function BulkStatusForm({ ids }: Props) {
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!status || ids.length === 0) return;
    setPending(true);
    try {
      await bulkStatusAendern(ids, status);
    } finally {
      setPending(false);
    }
  }

  if (ids.length === 0) return null;

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 p-3 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-200 dark:border-brand-800">
      <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
        {ids.length} ausgewählt
      </span>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="select text-sm"
      >
        <option value="">Status ändern auf...</option>
        {statusOptions.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!status || pending}
        className="btn-primary text-sm"
      >
        {pending ? 'Wird angewendet…' : 'Anwenden'}
      </button>
    </form>
  );
}
