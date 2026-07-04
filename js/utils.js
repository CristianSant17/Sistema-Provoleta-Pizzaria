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
  const map = { pendente: 'Pendente', em_preparo: 'Em preparo', entregue: 'Entregue', cancelado: 'Cancelado' };
  return map[status] || status;
}

/** Label de tamanho */
export function sizeLabel(size) {
  const map = { P: 'Pequena (P)', M: 'Média (M)', G: 'Grande (G)', Lata: 'Lata', '1L': '1 Litro' };
  return map[size] || size;
}

/** Regras por tamanho para pizzas com frações */
export function getPizzaSizeRules(size) {
  switch (size) {
    case 'P':
      return { maxFlavors: 2, allowedFractions: [1, 0.5], sizeLabel: 'Pequena', sizeShort: 'P' };
    case 'M':
      return { maxFlavors: 3, allowedFractions: [1, 0.5, 1 / 3], sizeLabel: 'Média', sizeShort: 'M' };
    case 'G':
    default:
      return { maxFlavors: 4, allowedFractions: [1, 0.5, 1 / 3, 0.25], sizeLabel: 'Grande', sizeShort: 'G' };
  }
}

/** Label da fração para exibição */
export function getPizzaFractionLabel(value) {
  const normalized = Number(value);
  if (Math.abs(normalized - 1) < 1e-9) return '1/1';
  if (Math.abs(normalized - 0.5) < 1e-9) return '1/2';
  if (Math.abs(normalized - 1 / 3) < 1e-9) return '1/3';
  if (Math.abs(normalized - 0.25) < 1e-9) return '1/4';
  return `${normalized.toFixed(2).replace(/\.0+$|0+$/, '')}`;
}

/** Texto simples da porção para o cliente */
export function getPizzaPortionLabel(value) {
  const normalized = Number(value);
  if (Math.abs(normalized - 1) < 1e-9) return 'Toda a pizza';
  if (Math.abs(normalized - 0.5) < 1e-9) return 'Metade da pizza';
  if (Math.abs(normalized - 1 / 3) < 1e-9) return 'Terço da pizza';
  if (Math.abs(normalized - 0.25) < 1e-9) return 'Quarto da pizza';
  return getPizzaFractionLabel(value);
}

/** Texto da opção de montagem para o cliente */
export function getPizzaPortionOptionLabel(value) {
  const normalized = Number(value);
  if (Math.abs(normalized - 1) < 1e-9) return '1 sabor';
  if (Math.abs(normalized - 0.5) < 1e-9) return '2 sabores';
  if (Math.abs(normalized - 1 / 3) < 1e-9) return '3 sabores';
  if (Math.abs(normalized - 0.25) < 1e-9) return '4 sabores';
  return getPizzaFractionLabel(value);
}

/** Texto de apoio da opção de montagem */
export function getPizzaPortionHint(value) {
  const normalized = Number(value);
  if (Math.abs(normalized - 1) < 1e-9) return 'Pizza inteira';
  if (Math.abs(normalized - 0.5) < 1e-9) return 'Metade para cada';
  if (Math.abs(normalized - 1 / 3) < 1e-9) return 'Terço para cada';
  if (Math.abs(normalized - 0.25) < 1e-9) return 'Quarto para cada';
  return getPizzaFractionLabel(value);
}

/** Opções de fração visuais para o montador */
export function getPizzaFractionOptions(size) {
  switch (size) {
    case 'P':
      return [
        { value: 1, label: getPizzaPortionOptionLabel(1), helper: getPizzaPortionHint(1) },
        { value: 0.5, label: getPizzaPortionOptionLabel(0.5), helper: getPizzaPortionHint(0.5) },
      ];
    case 'M':
      return [
        { value: 1, label: getPizzaPortionOptionLabel(1), helper: getPizzaPortionHint(1) },
        { value: 0.5, label: getPizzaPortionOptionLabel(0.5), helper: getPizzaPortionHint(0.5) },
        { value: 1 / 3, label: getPizzaPortionOptionLabel(1 / 3), helper: getPizzaPortionHint(1 / 3) },
      ];
    case 'G':
    default:
      return [
        { value: 1, label: getPizzaPortionOptionLabel(1), helper: getPizzaPortionHint(1) },
        { value: 0.5, label: getPizzaPortionOptionLabel(0.5), helper: getPizzaPortionHint(0.5) },
        { value: 1 / 3, label: getPizzaPortionOptionLabel(1 / 3), helper: getPizzaPortionHint(1 / 3) },
        { value: 0.25, label: getPizzaPortionOptionLabel(0.25), helper: getPizzaPortionHint(0.25) },
      ];
  }
}

/** Estado resumido do montador de pizza para UI e validação */
export function getPizzaBuilderState(size, rows = []) {
  if (!size) {
    return {
      rules: getPizzaSizeRules(size),
      entries: [],
      totalFraction: 0,
      remainingFraction: 1,
      remainingLabel: getPizzaPortionLabel(1),
      missingFlavorCount: 0,
      canAddFlavor: false,
      isComplete: false,
      isValid: false,
    };
  }
  const rules = getPizzaSizeRules(size);
  const entries = (rows || []).slice(0, rules.maxFlavors).map((entry) => ({
    id: entry.id || '',
    name: entry.name || entry.label || '',
  }));
  const fraction = entries.length ? 1 / entries.length : 0;
  const totalFraction = entries.reduce((sum) => sum + fraction, 0);
  const remainingFraction = Math.max(0, 1 - totalFraction);
  const missingFlavorCount = entries.filter((entry) => !entry.id).length;
  return {
    rules,
    entries: entries.map((entry) => ({
      ...entry,
      fraction,
      fractionLabel: getPizzaFractionLabel(fraction),
    })),
    totalFraction,
    remainingFraction,
    remainingLabel: getPizzaPortionLabel(remainingFraction),
    missingFlavorCount,
    canAddFlavor: entries.length < rules.maxFlavors,
    isComplete: Math.abs(totalFraction - 1) < 1e-9 && missingFlavorCount === 0,
    isValid: Math.abs(totalFraction - 1) < 1e-9 && missingFlavorCount === 0,
  };
}

/** Normaliza uma lista de sabores para o tamanho atual */
export function normalizePizzaFlavorEntries(size, flavors = []) {
  if (!size) {
    return [];
  }
  const rules = getPizzaSizeRules(size);
  const entries = (flavors || []).slice(0, rules.maxFlavors).map((entry) => ({
    id: entry?.id || '',
    name: entry?.name || entry?.label || '',
  }));
  const fraction = entries.length ? 1 / entries.length : 0;
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    fraction,
    fractionLabel: getPizzaFractionLabel(fraction),
  }));
}

/** Valida o estado atual de montagem da pizza */
export function getPizzaSelectionStatus(size, flavors = []) {
  const rules = getPizzaSizeRules(size);
  const normalized = normalizePizzaFlavorEntries(size, flavors || []);
  const total = normalized.reduce((sum, entry) => sum + (entry.fraction || 0), 0);
  const missingFlavorCount = normalized.filter((entry) => !entry.id).length;

  if (!size) {
    return { valid: false, message: 'Selecione um tamanho para montar a pizza.', totalFraction: 0, normalized, maxFlavors: rules.maxFlavors };
  }

  if (!normalized.length) {
    return { valid: false, message: 'Adicione pelo menos 1 sabor.', totalFraction: 0, normalized, maxFlavors: rules.maxFlavors };
  }

  if (missingFlavorCount > 0) {
    return { valid: false, message: 'Preencha todos os sabores antes de finalizar.', totalFraction: total, normalized, maxFlavors: rules.maxFlavors };
  }

  if (Math.abs(total - 1) > 1e-9) {
    return { valid: false, message: `Sua pizza está ${Math.round(total * 100)}% montada, adicione mais ${getPizzaPortionLabel(1 - total)}.`, totalFraction: total, normalized, maxFlavors: rules.maxFlavors };
  }

  return { valid: true, message: 'Pizza pronta para adicionar.', totalFraction: total, normalized, maxFlavors: rules.maxFlavors };
}

/** Calcula o preço da pizza considerando frações e adicionais */
export function calculatePizzaPrice({ size, flavors = [], additionals = [], flavorCatalog = [], categoryCatalog = [] }) {
  const totalFlavorBase = (flavors || []).reduce((sum, entry) => {
    const flavor = (flavorCatalog || []).find((item) => item.id === entry.id);
    const category = (categoryCatalog || []).find((item) => item.id === flavor?.categoryId);
    if (!category) return sum;
    const priceBySize = size === 'P' ? category.priceP : size === 'M' ? category.priceM : category.priceG;
    return sum + (priceBySize * (Number(entry.fraction) || 0));
  }, 0);

  const additionalPrice = (additionals || []).reduce((sum, extra) => sum + (Number(extra.price) || 0), 0);
  return Number((totalFlavorBase + additionalPrice).toFixed(2));
}

export function calculateOrderItemPrice({ type, size, flavors = [], itemId, additionals = [], flavorCatalog = [], categoryCatalog = [], drinksCatalog = [] }) {
  if (type === 'pizza') {
    return calculatePizzaPrice({ size, flavors, additionals, flavorCatalog, categoryCatalog });
  }
  if (type === 'bebida') {
    const drink = (drinksCatalog || []).find((d) => d.id === itemId);
    if (!drink) return 0;
    return Number((size === 'Lata' ? drink.priceLata : drink.price1L).toFixed(2));
  }
  return 0;
}

export function buildOrderItemName({ type, size, flavors = [], itemName }) {
  if (type === 'pizza') {
    return buildPizzaDisplayName({ size, flavors });
  }
  return `${itemName || 'Bebida'} ${size}`;
}

export function calculateOrderTotal({ items = [], deliveryFee = 0, discount = 0 }) {
  const subtotal = (items || []).reduce((sum, item) => sum + ((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0)), 0);
  return Number(Math.max(0, subtotal + Number(deliveryFee || 0) - Number(discount || 0)).toFixed(2));
}

/** Gera o nome textual do item pizza para painel e WhatsApp */
export function buildPizzaDisplayName({ size, flavors = [] }) {
  if (!size) return 'Pizza';
  const parts = (flavors || []).map((entry) => {
    const portionLabel = getPizzaPortionLabel(entry.fraction || 0);
    const name = entry.name || entry.label || '';
    return name ? `${portionLabel} ${name}` : portionLabel;
  }).filter(Boolean);
  return parts.length ? `Pizza ${size} (${parts.join(', ')})` : `Pizza ${size}`;
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
