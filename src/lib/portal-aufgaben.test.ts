import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  baueAufgaben, datumIso, tageZwischen, kuerzen,
  AUFGABEN_MAX, DETAIL_MAX, TITEL_MAX, type AufgabenDaten,
} from './portal-aufgaben';

const JETZT = new Date('2026-11-19T10:00:00Z');
const tag = (iso: string) => new Date(`${iso}T00:00:00Z`);

test('Datum in deutscher Zeit', () => {
  assert.equal(datumIso(new Date('2026-11-18T23:30:00Z')), '2026-11-19');
  assert.equal(tageZwischen(tag('2026-11-15'), JETZT), 4);
  assert.equal(tageZwischen(JETZT, tag('2026-11-22')), 3);
});

test('leere Daten und fehlende Rechte ergeben keine Einträge', () => {
  assert.deepEqual(baueAufgaben({}, JETZT), []);
  assert.deepEqual(
    baueAufgaben({
      wvUeberfaellig: { punkte: [], anzahl: 0 }, wvFaellig: { punkte: [], anzahl: 0 },
      rueckmeldungen: { punkte: [], anzahl: 0 }, neueAnfragen: { anzahl: 0, aelteste: null },
      langeWartezeit: { anzahl: 0, grenze: tag('2026-08-21') }, freiePlaetze: [{ name: 'WG Nord', frei: 0 }],
    }, JETZT),
    [],
  );
});

test('Einstufung, Texte, Pfade und Reihenfolge', () => {
  const daten: AufgabenDaten = {
    freiePlaetze: [{ name: 'WG Nord', frei: 2 }, { name: 'WG Süd', frei: 0 }, { name: 'WG West', frei: 1 }],
    langeWartezeit: { anzahl: 4, grenze: tag('2026-08-21') },
    neueAnfragen: { anzahl: 3, aelteste: tag('2026-11-10') },
    wvFaellig: { punkte: [{ id: 'w2', typ: 'WIEDERVORLAGE', faelligAm: tag('2026-11-22') }], anzahl: 1 },
    rueckmeldungen: { punkte: [{ id: 'i1', rueckmeldungBis: tag('2026-11-18') }], anzahl: 1 },
    wvUeberfaellig: { punkte: [{ id: 'w1', typ: 'RUECKRUF', faelligAm: tag('2026-11-15') }], anzahl: 1 },
  };
  assert.deepEqual(baueAufgaben(daten, JETZT), [
    { id: 'wv-w1', titel: 'Rückruf überfällig', detail: 'seit 4 Tagen überfällig', status: 'kritisch', faellig: '2026-11-15', pfad: '/wiedervorlagen' },
    { id: 'rueckmeldung-i1', titel: 'Rückmeldung zum Platzangebot überfällig', detail: 'seit gestern überfällig', status: 'kritisch', faellig: '2026-11-18', pfad: '/warteliste/i1' },
    { id: 'wv-w2', titel: 'Wiedervorlage fällig', detail: 'in 3 Tagen fällig', status: 'warnung', faellig: '2026-11-22', pfad: '/wiedervorlagen' },
    { id: 'lange-wartezeit', status: 'warnung', pfad: '/warteliste?bis=2026-08-21', titel: '4 Anfragen warten länger als 3 Monate', detail: 'eingetragen vor dem 21.08.2026' },
    { id: 'neue-anfragen', status: 'warnung', pfad: '/warteliste?status=NEUE_ANFRAGE', titel: '3 neue Anfragen unbearbeitet', detail: 'älteste vom 10.11.2026' },
    { id: 'freie-plaetze', status: 'info', pfad: '/plaetze', titel: '3 freie Plätze', detail: 'WG Nord: 2, WG West: 1' },
  ]);
});

test('mehr Punkte als einzeln genannt werden: Rest mit Anzahl zusammengefasst', () => {
  const liste = baueAufgaben({
    wvUeberfaellig: { punkte: [{ id: 'a', typ: 'SONSTIGES', faelligAm: tag('2026-11-01') }], anzahl: 8 },
  }, JETZT);
  assert.equal(liste.length, 2);
  assert.equal(liste[1].id, 'wv-ueberfaellig-weitere');
  assert.equal(liste[1].titel, '7 weitere Wiedervorlagen überfällig');
});

test('höchstens 50 Einträge, kritisch zuerst, Längen eingehalten, IDs eindeutig', () => {
  const viele = (praefix: string, n: number, start: string) =>
    Array.from({ length: n }, (_, i) => ({ id: `${praefix}${i}`, typ: 'RUECKRUF' as const, faelligAm: new Date(tag(start).getTime() + i * 3_600_000) }));
  const liste = baueAufgaben({
    wvUeberfaellig: { punkte: viele('u', 30, '2026-11-01'), anzahl: 30 },
    wvFaellig: { punkte: viele('f', 30, '2026-11-20'), anzahl: 30 },
    freiePlaetze: Array.from({ length: 40 }, (_, i) => ({ name: `Wohngemeinschaft Nummer ${i}`, frei: 1 })),
  }, JETZT);
  assert.equal(liste.length, AUFGABEN_MAX);
  assert.ok(liste.slice(0, 30).every((a) => a.status === 'kritisch'));
  assert.ok(liste.slice(30).every((a) => a.status === 'warnung'));
  assert.equal(new Set(liste.map((a) => a.id)).size, liste.length);
  for (const a of liste) {
    assert.ok(a.titel.length <= TITEL_MAX);
    assert.ok((a.detail ?? '').length <= DETAIL_MAX);
    assert.ok(a.pfad.startsWith('/') && !a.pfad.startsWith('//'));
    assert.match(a.faellig ?? '2026-01-01', /^\d{4}-\d{2}-\d{2}$/);
  }
  const frei = baueAufgaben({ freiePlaetze: Array.from({ length: 40 }, (_, i) => ({ name: `Wohngemeinschaft Nummer ${i}`, frei: 1 })) }, JETZT);
  assert.equal(frei[0].detail?.length, DETAIL_MAX);
  assert.ok(frei[0].detail?.endsWith('…'));
});

test('kuerzen', () => {
  assert.equal(kuerzen('abc', 3), 'abc');
  assert.equal(kuerzen('abcdef', 4), 'abc…');
});
