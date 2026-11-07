// Helpers puros de data.

// 'YYYY-MM-DD' estrito e data real do calendário (rejeita 2026-02-30, 2026-13-01, 2026-00-10).
// Obs.: lógica equivalente existe em bookings.service.js (duplicação intencional, card 5).
function ehDataValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

module.exports = { ehDataValida };
