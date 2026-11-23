import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  baueAntwort, ereignisAusAudit, markeBilden, markeLesen,
  MARKE_ANFANG, TEXT_MAX, type AuditZeile,
} from './portal-aktivitaet';

const ZEIT = new Date('2026-11-23T10:31:03.000Z');
const PETRA = { username: 'p.muster', vorname: 'Petra', nachname: 'Muster' };

let lfd = 0;
function zeile(aktion: string, entitaet: string, details: string | null, mehr: Partial<AuditZeile> = {}): AuditZeile {
  lfd += 1;
  return {
    id: `cm${String(lfd).padStart(6, '0')}`, zeitpunkt: new Date(ZEIT.getTime() + lfd), aktion, entitaet,
    entitaetId: 'cmabc123', details, user: PETRA, ...mehr,
  };
}

test('Aktion und Art des Datensatzes ergeben feste Texte', () => {
  const faelle: [AuditZeile, string, string, string | undefined][] = [
    [zeile('CREATE', 'Interessent', 'Erna Beispiel'), 'angelegt', 'Interessent angelegt', '/warteliste/cmabc123'],
    [zeile('UPDATE', 'Interessent', 'Erna Beispiel'), 'geaendert', 'Interessent geändert', '/warteliste/cmabc123'],
    [zeile('UPDATE', 'Interessent', 'Status geändert'), 'geaendert', 'Status eines Interessenten geändert', '/warteliste/cmabc123'],
    [zeile('UPDATE', 'Interessent', 'Status geändert (7 Datensätze)', { entitaetId: null }), 'geaendert', 'Status von 7 Interessenten geändert', '/warteliste'],
    [zeile('UPDATE', 'Interessent', 'Status geändert (1 Datensätze)', { entitaetId: null }), 'geaendert', 'Status eines Interessenten geändert', '/warteliste'],
    [zeile('UPDATE', 'Interessent', 'Markierung geändert'), 'geaendert', 'Interessent geändert', '/warteliste/cmabc123'],
    [zeile('UPDATE', 'Interessent', 'Zimmer angeboten'), 'geaendert', 'Zimmer angeboten', '/warteliste/cmabc123'],
    [zeile('UPDATE', 'Interessent', 'Kontakt eingetragen'), 'geaendert', 'Kontakt eingetragen', '/warteliste/cmabc123'],
    [zeile('UPDATE', 'Platz', 'belegt'), 'geaendert', 'Platz belegt', '/plaetze'],
    [zeile('UPDATE', 'Platz', 'freigegeben'), 'geaendert', 'Platz freigegeben', '/plaetze'],
    [zeile('CREATE', 'Platz', null), 'angelegt', 'Platz angelegt', '/plaetze'],
    [zeile('UPDATE', 'User', 'PIN geändert'), 'geaendert', 'Eigene PIN geändert', '/profil'],
    [zeile('DELETE', 'Interessent', 'Erna Beispiel'), 'geloescht', 'Interessent gelöscht', '/warteliste'],
    [zeile('CREATE', 'Wiedervorlage', 'Tochter anrufen'), 'angelegt', 'Wiedervorlage angelegt', '/wiedervorlagen'],
    [zeile('UPDATE', 'Wiedervorlage', 'erledigt'), 'erledigt', 'Wiedervorlage erledigt', '/wiedervorlagen'],
    [zeile('UPDATE', 'Wiedervorlage', 'wieder offen'), 'geaendert', 'Wiedervorlage wieder geöffnet', '/wiedervorlagen'],
    [zeile('DELETE', 'Wiedervorlage', 'Tochter anrufen'), 'geloescht', 'Wiedervorlage gelöscht', '/wiedervorlagen'],
    [zeile('CREATE', 'Standort', 'WG Nord'), 'angelegt', 'Standort angelegt', '/standorte'],
    [zeile('UPDATE', 'Standort', 'WG Nord'), 'geaendert', 'Standort geändert', '/standorte'],
    [zeile('UPDATE', 'Standort', 'deaktiviert'), 'geaendert', 'Standort deaktiviert', '/standorte'],
    [zeile('UPDATE', 'Platz', 'als frei markiert'), 'geaendert', 'Platz als frei markiert', '/plaetze'],
    [zeile('UPDATE', 'Platz', 'als belegt markiert'), 'geaendert', 'Platz als belegt markiert', '/plaetze'],
    [zeile('UPDATE', 'Platz', '12a'), 'geaendert', 'Platz geändert', '/plaetze'],
    [zeile('DELETE', 'Platz', null), 'geloescht', 'Platz gelöscht', '/plaetze'],
    [zeile('CREATE', 'User', 'Kai Neu (KN) → k.neu'), 'angelegt', 'Benutzerkonto angelegt', '/benutzer'],
    [zeile('CREATE', 'User', 'Kai Neu (KN) → k.neu – über Portal'), 'angelegt', 'Benutzerkonto angelegt (über das Portal)', '/benutzer'],
    [zeile('UPDATE', 'User', 'Kai Neu (KN)'), 'geaendert', 'Benutzerkonto geändert', '/benutzer'],
    [zeile('UPDATE', 'User', 'deaktiviert'), 'geaendert', 'Benutzerkonto gesperrt', '/benutzer'],
    [zeile('UPDATE', 'User', 'deaktiviert – über Portal'), 'geaendert', 'Benutzerkonto gesperrt (über das Portal)', '/benutzer'],
    [zeile('UPDATE', 'User', 'aktiviert – über Portal'), 'geaendert', 'Benutzerkonto entsperrt (über das Portal)', '/benutzer'],
    [zeile('UPDATE', 'User', 'Rolle geändert: Verwaltung → PDL – über Portal'), 'geaendert', 'Rolle eines Benutzerkontos geändert (über das Portal)', '/benutzer'],
    [zeile('DELETE', 'User', 'Kai Neu (KN)'), 'geloescht', 'Benutzerkonto gelöscht', '/benutzer'],
    [zeile('UPDATE', 'SystemSettings', 'Berechtigungsmatrix aktualisiert'), 'geaendert', 'Berechtigungen geändert', '/einstellungen'],
    [zeile('LOGIN', 'User', 'Anmeldung von IP 10.1.2.3'), 'anmeldung', 'Anmeldung', undefined],
    [zeile('LOGIN', 'User', 'Anmeldung über Portal von IP 10.1.2.3'), 'anmeldung', 'Anmeldung über das Portal', undefined],
    [zeile('UPDATE', 'Unbekannt', 'irgendwas'), 'geaendert', 'Eintrag geändert', undefined],
  ];
  for (const [z, art, text, pfad] of faelle) {
    const e = ereignisAusAudit(z);
    assert.ok(e, text);
    assert.equal(e.art, art, text);
    assert.equal(e.text, text);
    assert.equal(e.pfad, pfad, text);
    assert.equal(e.benutzername, 'p.muster');
    assert.equal(e.name, 'Petra Muster');
    assert.equal(e.id, z.id);
    assert.equal(e.zeit, z.zeitpunkt.toISOString());
  }
});

test('Abmeldungen, Exporte und unbekannte Aktionen sind keine Ereignisse', () => {
  assert.equal(ereignisAusAudit(zeile('LOGOUT', 'User', 'Abmeldung')), null);
  assert.equal(ereignisAusAudit(zeile('LOGOUT', 'User', 'Automatische Abmeldung nach Inaktivität')), null);
  assert.equal(ereignisAusAudit(zeile('EXPORT', 'Interessent', 'Format CSV, 12 Datensätze')), null);
  assert.equal(ereignisAusAudit(zeile('LESEN', 'Interessent', null)), null);
});

test('ohne handelnde Person (Portal, gelöschtes Konto): benutzername und name sind null', () => {
  const e = ereignisAusAudit(zeile('UPDATE', 'User', 'deaktiviert – über Portal', { user: null }));
  assert.equal(e?.benutzername, null);
  assert.equal(e?.name, null);
});

test('Datenschutz: nichts aus den gespeicherten Texten erscheint in der Antwort', () => {
  // Alles, was Menschen eintippen koennen, traegt eines dieser Merkmale
  const GEHEIM = ['Schneewittchen', 'Rumpelstilz', 'Demenz', 'Sturzgefahr', 'Insulin', '192.168', 'Froschkoenig', 'Zimmer-Rapunzel'];
  const frei = 'Erna Schneewittchen, Tochter Rumpelstilz, Demenz, Sturzgefahr, Insulin, 192.168.7.9, Froschkoenig, Zimmer-Rapunzel';
  const aktionen = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT'];
  const entitaeten = ['Interessent', 'Wiedervorlage', 'Standort', 'Platz', 'User', 'SystemSettings', 'Historie', 'Schneewittchen'];
  const texte = [
    frei, `${frei} – über Portal`, `Anmeldung über Portal von IP 192.168.7.9 ${frei}`, `Anmeldung von IP 192.168.7.9`,
    `Rolle geändert: ${frei} – über Portal`, `erledigt ${frei}`, `deaktiviert ${frei}`, `aktiviert ${frei} – über Portal`,
    `als frei markiert ${frei}`, `Status geändert (${frei} Datensätze)`, `Zimmer angeboten ${frei}`, `PIN geändert ${frei}`, `${frei} erledigt`, `Erna Schneewittchen (ES) → e.schneewittchen – über Portal`,
  ];
  const zeilen: AuditZeile[] = [];
  for (const a of aktionen) for (const en of entitaeten) for (const t of texte) {
    zeilen.push(zeile(a, en, t, { entitaetId: 'Rumpelstilz/../x' }));
    zeilen.push(zeile(a, en, t, { user: null }));
  }
  const antwort = baueAntwort(zeilen, null);
  assert.ok(antwort.ereignisse.length > 100);
  const erlaubt = /^[A-Za-zÄÖÜäöüß ()]+$/; // in diesem Test auch keine Ziffern
  for (const e of antwort.ereignisse) {
    assert.match(e.text, erlaubt);
    assert.ok(e.text.length <= TEXT_MAX);
    // Pfade: nur feste Seiten, eine Kennung nur in der bekannten Form
    assert.match(e.pfad ?? '/', /^\/[a-z]*(\/cmabc123)?$/);
  }
  const roh = JSON.stringify(antwort);
  for (const g of GEHEIM) assert.ok(!roh.includes(g), `"${g}" darf nicht in der Antwort stehen`);
  // Die handelnde Person ist erlaubt und bleibt genannt
  assert.ok(roh.includes('Petra Muster'));
});

test('Marke: lesen, bilden, Unsinn abweisen', () => {
  const m = markeBilden(ZEIT, 'cmabc123');
  assert.equal(m, `${ZEIT.getTime()}-cmabc123`);
  assert.deepEqual(markeLesen(m), { zeit: ZEIT, id: 'cmabc123' });
  assert.deepEqual(markeLesen(MARKE_ANFANG), { zeit: new Date(0), id: '0' });
  for (const unsinn of [null, undefined, '', 'abc', '184467', '-cm1', '12-', "1-a' OR 1=1", '99999999999999999999-a', '1-ä', ' 1-a']) {
    assert.equal(markeLesen(unsinn), null, String(unsinn));
  }
});

test('Antwort: Marke zeigt auf die letzte Zeile, bleibt ohne neue Zeilen stehen', () => {
  const a = zeile('CREATE', 'Platz', '3');
  const b = zeile('LOGOUT', 'User', 'Abmeldung');
  const antwort = baueAntwort([a, b], null);
  assert.equal(antwort.ereignisse.length, 1);
  assert.equal(antwort.marke, markeBilden(b.zeitpunkt, b.id));

  const bisher = markeLesen(antwort.marke);
  assert.deepEqual(baueAntwort([], bisher), { marke: antwort.marke, ereignisse: [] });
  assert.deepEqual(baueAntwort([], null), { marke: MARKE_ANFANG, ereignisse: [] });
});
