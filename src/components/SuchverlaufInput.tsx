'use client';

import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'wp_suchverlauf';
const MAX_ENTRIES = 5;

interface Props {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}

export default function SuchverlaufInput({ name, defaultValue = '', placeholder, className }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [verlauf, setVerlauf] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setVerlauf(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function saveToVerlauf(val: string) {
    if (!val.trim()) return;
    const updated = [val, ...verlauf.filter((v) => v !== val)].slice(0, MAX_ENTRIES);
    setVerlauf(updated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      saveToVerlauf(value);
      setOpen(false);
    }
  }

  function selectEntry(entry: string) {
    setValue(entry);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <input
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => verlauf.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className ?? 'input'}
        autoComplete="off"
      />
      {open && verlauf.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden">
          {verlauf.map((entry, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => selectEntry(entry)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50 dark:hover:bg-white/5"
            >
              🕐 {entry}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
