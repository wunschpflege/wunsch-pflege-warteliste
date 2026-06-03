'use client';

import { STATUS_LABEL } from '@/lib/labels';
import { schnellStatusAendern } from '@/app/(app)/warteliste/actions';

interface Props {
  id: string;
  currentStatus: string;
}

const statusOptions = Object.entries(STATUS_LABEL) as [string, string][];

export default function SchnellStatusSelect({ id, currentStatus }: Props) {
  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    await schnellStatusAendern(id, e.target.value);
  }

  return (
    <select
      defaultValue={currentStatus}
      onChange={handleChange}
      className="select text-xs py-1 px-2 h-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {statusOptions.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}
