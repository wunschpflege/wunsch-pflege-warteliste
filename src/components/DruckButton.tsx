'use client';

export default function DruckButton() {
  return (
    <button onClick={() => window.print()} className="btn-ghost no-print">
      🖨 Drucken
    </button>
  );
}
