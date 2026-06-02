'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      className="btn-ghost h-9 w-9 !px-0"
      aria-label="Design umschalten"
      title={dark ? 'Hellmodus' : 'Dunkelmodus'}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
