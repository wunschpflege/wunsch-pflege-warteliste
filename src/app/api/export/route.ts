import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { buildInteressentWhere, filterFromSearchParams } from '@/lib/interessentFilter';
import { STATUS_LABEL, PRIO_LABEL, PFLEGEGRAD_LABEL, fmtDate, fmtDateTime } from '@/lib/labels';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type Row = Prisma.InteressentGetPayload<{ include: { standort: true; erstelltVon: true } }>;

const COLUMNS: { header: string; value: (r: Row) => string }[] = [
  { header: 'Nachname', value: (r) => r.nachname },
  { header: 'Vorname', value: (r) => r.vorname },
  { header: 'Geburtsdatum', value: (r) => fmtDate(r.geburtsdatum) },
  { header: 'Pflegegrad', value: (r) => PFLEGEGRAD_LABEL[r.pflegegrad] },
  { header: 'Krankenkasse', value: (r) => r.krankenkasse ?? '' },
  { header: 'Wohnsituation', value: (r) => r.wohnsituation ?? '' },
  { header: 'Gew. Einzug', value: (r) => fmtDate(r.gewuenschterEinzug) },
  { header: 'Standort', value: (r) => r.standort?.name ?? '' },
  { header: 'Priorität', value: (r) => PRIO_LABEL[r.prioritaet] },
  { header: 'Status', value: (r) => STATUS_LABEL[r.status] },
  { header: 'Angehöriger', value: (r) => [r.angehoerigerVorname, r.angehoerigerNachname].filter(Boolean).join(' ') },
  { header: 'Beziehung', value: (r) => r.angehoerigerBeziehung ?? '' },
  { header: 'Telefon Festnetz', value: (r) => r.telefonFestnetz ?? '' },
  { header: 'Telefon Mobil', value: (r) => r.telefonMobil ?? '' },
  { header: 'E-Mail', value: (r) => r.email ?? '' },
  { header: 'Eingetragen am', value: (r) => fmtDate(r.createdAt) },
  { header: 'Mitarbeiter', value: (r) => r.erstelltVon.kuerzel },
];

function csvCell(v: string): string {
  if (/[";\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  if (!can(user, 'export')) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const format = (sp.get('format') ?? 'csv').toLowerCase();
  const where = buildInteressentWhere(filterFromSearchParams(sp));

  const rows = await prisma.interessent.findMany({
    where,
    include: { standort: true, erstelltVon: true },
    orderBy: [{ prioritaet: 'desc' }, { createdAt: 'asc' }],
  });

  await audit(user, 'EXPORT', 'Interessent', undefined, `Format ${format.toUpperCase()}, ${rows.length} Datensätze`);

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `warteliste_${stamp}`;

  // ---- CSV ----
  if (format === 'csv') {
    const header = COLUMNS.map((c) => csvCell(c.header)).join(';');
    const body = rows.map((r) => COLUMNS.map((c) => csvCell(c.value(r))).join(';')).join('\r\n');
    const csv = '\uFEFF' + header + '\r\n' + body; // BOM für Excel/Umlaute
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  }

  // ---- Excel (XLSX) ----
  if (format === 'xlsx' || format === 'excel') {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Wunsch-Pflege GmbH';
    wb.created = new Date();
    const ws = wb.addWorksheet('Warteliste');

    ws.columns = COLUMNS.map((c) => ({ header: c.header, width: Math.max(14, c.header.length + 2) }));
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    ws.getRow(1).alignment = { vertical: 'middle' };

    rows.forEach((r) => ws.addRow(COLUMNS.map((c) => c.value(r))));
    ws.autoFilter = { from: 'A1', to: { row: 1, column: COLUMNS.length } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buf as ArrayBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  // ---- PDF (druckfertige HTML-Ansicht, im Browser via "Als PDF speichern") ----
  if (format === 'pdf') {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const headCells = COLUMNS.map((c) => `<th>${esc(c.header)}</th>`).join('');
    const bodyRows = rows
      .map((r) => `<tr>${COLUMNS.map((c) => `<td>${esc(c.value(r))}</td>`).join('')}</tr>`)
      .join('');

    const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8" />
<title>Warteliste – Wunsch-Pflege GmbH</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 24px; color: #111; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #0f766e; padding-bottom: 8px; margin-bottom: 16px; }
  h1 { font-size: 18px; color: #0f766e; margin: 0; }
  .meta { font-size: 11px; color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th, td { border: 1px solid #d4d4d4; padding: 4px 5px; text-align: left; vertical-align: top; }
  th { background: #0f766e; color: #fff; font-weight: 600; }
  tr:nth-child(even) td { background: #f5f7f7; }
  .toolbar { margin-bottom: 14px; }
  button { background: #0f766e; color: #fff; border: 0; padding: 8px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; }
  @media print { .toolbar { display: none; } body { margin: 8mm; } @page { size: A4 landscape; margin: 10mm; } }
</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">Als PDF drucken / speichern</button></div>
  <header>
    <h1>Wunsch-Pflege GmbH · Warteliste</h1>
    <div class="meta">Erstellt: ${esc(fmtDateTime(new Date()))} · ${rows.length} Datensätze · ${esc(user.kuerzel)}</div>
  </header>
  <table><thead><tr>${headCells}</tr></thead><tbody>${bodyRows || `<tr><td colspan="${COLUMNS.length}">Keine Datensätze.</td></tr>`}</tbody></table>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 350); });</script>
</body></html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.json({ error: 'Unbekanntes Format. Erlaubt: csv, xlsx, pdf' }, { status: 400 });
}
