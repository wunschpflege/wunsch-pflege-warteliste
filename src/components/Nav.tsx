'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Role } from '@prisma/client';

interface NavProps {
  user: { vorname: string; nachname: string; kuerzel: string; role: Role };
  canUsers: boolean;
  canStandorte: boolean;
  canEinstellungen: boolean;
}

const ROLE_LABEL: Record<Role, string> = {
  GESCHAEFTSFUEHRUNG: 'Geschäftsführung',
  PDL: 'PDL',
  VERWALTUNG: 'Verwaltung',
};

const ICONS: Record<string, React.ReactNode> = {
  dashboard:    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  warteliste:   <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  plaetze:      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  wiedervorlagen:<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
  standorte:    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  benutzer:     <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>,
  einstellungen:<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  statistik:    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  profil:       <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
};

export default function Nav({ user, canUsers, canStandorte, canEinstellungen }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links = [
    { href: '/dashboard',     label: 'Dashboard',     key: 'dashboard' },
    { href: '/warteliste',    label: 'Warteliste',     key: 'warteliste' },
    { href: '/plaetze',       label: 'Unsere Häuser',  key: 'plaetze' },
    { href: '/statistik',     label: 'Statistik',      key: 'statistik' },
    ...(canStandorte ? [{ href: '/standorte', label: 'Standorte', key: 'standorte' }] : []),
    ...(canUsers     ? [{ href: '/benutzer',       label: 'Benutzer',      key: 'benutzer'       }] : []),
    ...(canEinstellungen ? [{ href: '/einstellungen', label: 'Einstellungen', key: 'einstellungen' }] : []),
  ];

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="hidden md:flex items-center gap-3 mb-8 px-1">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-white font-bold text-sm shadow-sm">WP</div>
        <div>
          <p className="font-bold text-sm leading-tight">Wunsch-Pflege</p>
          <p className="text-xs text-muted">Wartelistenverwaltung</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-0.5 flex-1">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + '/');
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-[var(--text)] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <span className={active ? 'opacity-100' : 'opacity-50'}>{ICONS[l.key]}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="pt-4 mt-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="kuerzel h-9 w-9 text-sm flex-shrink-0">{user.kuerzel}</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{user.vorname} {user.nachname}</p>
            <p className="text-xs text-muted">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/profil" onClick={() => setOpen(false)} className="btn-ghost flex-1 text-xs h-8 flex items-center gap-1.5">
            <span className="opacity-60">{ICONS.profil}</span>Profil
          </Link>
          <button onClick={logout} className="btn-ghost flex-1 text-xs h-8">Abmelden</button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Top-Bar */}
      <header className="md:hidden flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 h-14 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-white text-sm font-bold">WP</div>
          <span className="font-bold text-sm">Wunsch-Pflege</span>
        </div>
        <button className="btn-ghost h-9 w-9 !px-0" onClick={() => setOpen(!open)} aria-label="Menü">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </header>

      {/* Mobile Dropdown */}
      {open && (
        <div className="md:hidden fixed inset-x-0 top-14 z-20 bg-[var(--surface)] border-b border-[var(--border)] p-4 shadow-lg">
          <SidebarContent />
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 min-h-screen border-r border-[var(--border)] bg-[var(--surface)] p-4 sticky top-0 h-screen">
        <SidebarContent />
      </aside>
    </>
  );
}
