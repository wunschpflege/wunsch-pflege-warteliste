import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inaktivMinuten, inaktivMs, schreibDrosselMs, warnVorlaufMs, meldeAbstandMs,
  istAbgelaufen, istHintergrundAnfrage, abgemeldetHinweis,
} from './inaktiv';

test('Standard sind 15 Minuten', () => {
  assert.equal(inaktivMinuten({}), 15);
  assert.equal(inaktivMinuten({ INAKTIV_MINUTEN: '' }), 15);
  assert.equal(inaktivMs({}), 15 * 60_000);
});

test('erlaubt sind 0.1 bis 240, auch mit Komma', () => {
  assert.equal(inaktivMinuten({ INAKTIV_MINUTEN: '30' }), 30);
  assert.equal(inaktivMinuten({ INAKTIV_MINUTEN: ' 0.3 ' }), 0.3);
  assert.equal(inaktivMinuten({ INAKTIV_MINUTEN: '0,5' }), 0.5);
  assert.equal(inaktivMinuten({ INAKTIV_MINUTEN: '0.1' }), 0.1);
  assert.equal(inaktivMinuten({ INAKTIV_MINUTEN: '240' }), 240);
  assert.equal(inaktivMs({ INAKTIV_MINUTEN: '0,3' }), 18_000);
});

test('alles andere ergibt 15 Minuten', () => {
  for (const wert of ['0', '0.05', '241', '-5', 'abc', '15min', '1e2', '1.2.3', 'Infinity', 'NaN', '.5']) {
    assert.equal(inaktivMinuten({ INAKTIV_MINUTEN: wert }), 15, wert);
  }
});

test('Abstände: im Betrieb 30 s / 60 s / 60 s, bei Testdauern kürzer', () => {
  const normal = 15 * 60_000;
  assert.equal(schreibDrosselMs(normal), 30_000);
  assert.equal(warnVorlaufMs(normal), 60_000);
  assert.equal(meldeAbstandMs(normal), 60_000);
  const kurz = 18_000;
  assert.equal(schreibDrosselMs(kurz), 1_800);
  assert.equal(warnVorlaufMs(kurz), 9_000);
  assert.equal(meldeAbstandMs(kurz), 4_500);
});

test('abgelaufen erst nach der Dauer', () => {
  assert.equal(istAbgelaufen(0, 900_000, 900_000), false);
  assert.equal(istAbgelaufen(0, 900_001, 900_000), true);
});

test('Hintergrund-Anfragen zählen nicht als Eingabe', () => {
  const kopf = (h: Record<string, string>) => ({ get: (n: string) => h[n] ?? null });
  assert.equal(istHintergrundAnfrage(kopf({})), false);
  assert.equal(istHintergrundAnfrage(kopf({ 'x-hintergrund': '1' })), true);
  assert.equal(istHintergrundAnfrage(kopf({ 'x-hintergrund': '0' })), false);
  assert.equal(istHintergrundAnfrage(kopf({ purpose: 'prefetch' })), true);
  assert.equal(istHintergrundAnfrage(kopf({ 'sec-purpose': 'prefetch;prerender' })), true);
});

test('Hinweistext nennt die eingestellten Minuten', () => {
  assert.equal(abgemeldetHinweis(15), 'Du wurdest nach 15 Minuten ohne Eingabe automatisch abgemeldet.');
  assert.equal(abgemeldetHinweis(1), 'Du wurdest nach 1 Minute ohne Eingabe automatisch abgemeldet.');
  assert.equal(abgemeldetHinweis(0.3), 'Du wurdest nach 0,3 Minuten ohne Eingabe automatisch abgemeldet.');
});
