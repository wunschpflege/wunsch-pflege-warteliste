'use client';

interface Props {
  label: string;
  field: string;
  currentSort: string;
  currentDir: string;
  baseUrl: string;
}

export default function SortHeader({ label, field, currentSort, currentDir, baseUrl }: Props) {
  const isActive = currentSort === field;
  const nextDir = isActive && currentDir === 'asc' ? 'desc' : 'asc';
  const url = `${baseUrl}&sortBy=${field}&sortDir=${nextDir}`;

  return (
    <a href={url} className="flex items-center gap-1 hover:text-brand-600 whitespace-nowrap">
      {label}
      {isActive ? (
        <span className="text-brand-600">{currentDir === 'asc' ? '↑' : '↓'}</span>
      ) : (
        <span className="text-muted opacity-40">↕</span>
      )}
    </a>
  );
}
