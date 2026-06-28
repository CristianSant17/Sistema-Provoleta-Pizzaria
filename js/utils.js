/**
 * PROVOLETA — Utilitários gerais
 */

/** Gera ID único */
export function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Formata valor monetário BRL */
export function formatMoney(value) {
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Parse de valor monetário */
export function parseMoney(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const cleaned = String(str).replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

/** Data/hora atual no formato datetime-local */
export function nowDatetimeLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converte datetime-local para ISO */
export function datetimeLocalToISO(local) {
  if (!local) return new Date().toISOString();
  return new Date(local).toISOString();
}

/** Converte ISO para datetime-local (edição de pedidos) */
export function isoToDatetimeLocal(iso) {
  if (!iso) return nowDatetimeLocal();
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Formata data/hora para exibição */
export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Formata apenas data */
export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

/** Extrai year/month de string YYYY-MM */
export function parseMonthRef(value) {
  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

/** Retorna mês atual como YYYY-MM */
export function currentMonthRef() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Nome do mês por extenso */
export function monthLabel(year, month) {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/** Escapa HTML para prevenir XSS */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/** Label de forma de pagamento */
export function paymentLabel(method) {
  const map = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão' };
  return map[method] || method;
}

/** Label de status */
export function statusLabel(status) {
  const map = { pendente: 'Pendente', entregue: 'Entregue', cancelado: 'Cancelado' };
  return map[status] || status;
}

/** Label de tamanho */
export function sizeLabel(size) {
  const map = { P: 'Pequena (P)', M: 'Média (M)', G: 'Grande (G)', Lata: 'Lata', '1L': '1 Litro' };
  return map[size] || size;
}

/** Verifica se duas datas ISO são no mesmo dia */
export function isSameDay(iso1, iso2) {
  const d1 = new Date(iso1);
  const d2 = new Date(iso2);
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate();
}

/** Data de hoje como YYYY-MM-DD */
export function todayDateInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Download de arquivo JSON */
export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Debounce simples */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Normaliza WhatsApp para wa.me (apenas DDD + número, sem 55 duplicado) */
export function normalizeWhatsApp(raw) {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  return digits;
}

/** Monta URL wa.me a partir de número bruto ou formatado */
export function whatsappUrl(raw, text = '') {
  const digits = normalizeWhatsApp(raw);
  if (!digits) return null;
  const base = `https://wa.me/55${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
