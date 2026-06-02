'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Role } from '@prisma/client';
import ThemeToggle from './ThemeToggle';

interface NavProps {
  user: { vorname: string; nachname: string; kuerzel: string; role: Role };
  canUsers: boolean;
  canStandorte: boolean;
}

const ROLE_LABEL: Record<Role, string> = {
  GESCHAEFTSFUEHRUNG: 'Geschäftsführung',
  PDL: 'PDL',
  VERWALTUNG: 'Verwaltung',
};

export default function Nav({ user, canUsers, canStandorte }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/warteliste', label: 'Warteliste', icon: '📋' },
    { href: '/plaetze', label: 'Freie Plätze', icon: '🛏️' },
    { href: '/wiedervorlagen', label: 'Wiedervorlagen', icon: '🔔' },
    ...(canStandorte ? [{ href: '/standorte', label: 'Standorte', icon: '🏠' }] : []),
    ...(canUsers ? [{ href: '/benutzer', label: 'Benutzer', icon: '👥' }] : []),
  ];

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* Mobile Top-Bar */}
      <header className="md:hidden flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 h-14 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-600 grid place-items-center text-white text-sm font-bold">WP</div>
          <span className="font-semibold text-sm">Wunsch-Pflege</span>
        </div>
        <button className="btn-ghost h-9 w-9 !px-0" onClick={() => setOpen(!open)} aria-label="Menü">
          ☰
        </button>
      </header>

      <aside
        className={`${open ? 'block' : 'hidden'} md:block fixed md:static z-20 inset-x-0 top-14 md:top-0
        md:h-screen w-full md:w-64 border-r border-[var(--border)] bg-[var(--surface)] p-4 md:flex md:flex-col`}
      >
        <div className="hidden md:flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-lg bg-brand-600 grid place-items-center text-white font-bold">WP</div>
          <div>
            <p className="font-semibold text-sm leading-tight">Wunsch-Pflege</p>
            <p className="text-xs text-muted">Wartelisten</p>
          </div>
        </div>

        <nav className="space-y-1">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + '/');
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-brand-600 text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span>{l.icon}</span>
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="md:mt-auto pt-4 mt-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-3 mb-3">
            <span className="kuerzel h-9 w-9 text-sm">{user.kuerzel}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.vorname} {user.nachname}</p>
              <p className="text-xs text-muted">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={logout} className="btn-ghost flex-1">Abmelden</button>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}
