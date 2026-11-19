import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portalAnmeldungBasis, portalAnmeldeLink } from './portal-anmeldung';

const SECRET = 'x'.repeat(32);

test('ohne PORTAL_ANMELDUNG_URL bleibt alles wie bisher', () => {
  assert.equal(portalAnmeldungBasis({ PORTAL_SECRET: SECRET }), null);
  assert.equal(portalAnmeldungBasis({ PORTAL_SECRET: SECRET, PORTAL_ANMELDUNG_URL: '   ' }), null);
  assert.equal(portalAnmeldeLink('warteliste', {}), null);
});

test('wirkt nur zusammen mit gültigem PORTAL_SECRET', () => {
  const url = 'https://portal.example';
  assert.equal(portalAnmeldungBasis({ PORTAL_ANMELDUNG_URL: url }), null);
  assert.equal(portalAnmeldungBasis({ PORTAL_ANMELDUNG_URL: url, PORTAL_SECRET: 'zu-kurz' }), null);
  assert.equal(portalAnmeldungBasis({ PORTAL_ANMELDUNG_URL: url, PORTAL_SECRET: SECRET }), url);
});

test('nur https, lokal auch http://localhost', () => {
  const basis = (u: string) => portalAnmeldungBasis({ PORTAL_SECRET: SECRET, PORTAL_ANMELDUNG_URL: u });
  assert.equal(basis('http://portal.example'), null);
  assert.equal(basis('portal.example'), null);
  assert.equal(basis('javascript:alert(1)'), null);
  assert.equal(basis('ftp://portal.example'), null);
  assert.equal(basis('https://benutzer:geheim@portal.example'), null);
  assert.equal(basis('http://localhost.example'), null);
  assert.equal(basis('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(basis('https://portal.example/'), 'https://portal.example');
});

test('Knopf zeigt auf <Portal>/go/<programm-id>', () => {
  const env = { PORTAL_SECRET: SECRET, PORTAL_ANMELDUNG_URL: 'https://portal.example/' };
  assert.equal(portalAnmeldeLink('warteliste', env), 'https://portal.example/go/warteliste');
});
