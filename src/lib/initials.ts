/**
 * Erzeugt das Mitarbeiterkuerzel aus Vor- und Nachname.
 * Beispiele: "Alexander Markus" -> "AM", "Sophie Wunsch" -> "SW".
 * Bei Mehrteilern werden die ersten Buchstaben des ersten Vor-
 * und des letzten Nachnamens verwendet.
 */
export function buildInitials(vorname: string, nachname: string): string {
  const v = (vorname || '').trim().split(/\s+/)[0] ?? '';
  const nParts = (nachname || '').trim().split(/\s+/);
  const n = nParts[nParts.length - 1] ?? '';
  const first = v.charAt(0).toUpperCase();
  const last = n.charAt(0).toUpperCase();
  return (first + last) || 'XX';
}
