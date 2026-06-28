/**
 * PROVOLETA — Camada de Storage (LocalStorage)
 * Gerencia persistência indexada por Mês/Ano para pedidos e caixa.
 */

import { DEFAULT_WHATSAPP_FORMATTED } from './constants.js';

const PREFIX = 'provoleta_';
const VERSION = '1.0.0';

/** Chaves fixas (não mensais) */
export const KEYS = {
  CONFIG: `${PREFIX}config`,
  ESTOQUE: `${PREFIX}estoque`,
  META: `${PREFIX}meta`,
  SETTINGS: `${PREFIX}settings`,
};

/** Gera chave mensal: provoleta_pedidos_2026_06 */
export function monthKey(type, year, month) {
  const m = String(month).padStart(2, '0');
  return `${PREFIX}${type}_${year}_${m}`;
}

/** Lista todas as chaves do LocalStorage do sistema */
export function getAllProvoletaKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
}

/** Leitura genérica com fallback */
export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Gravação genérica */
export function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

/** Remove chave */
export function remove(key) {
  localStorage.removeItem(key);
}

/** Limpa todo o LocalStorage do sistema */
export function clearAll() {
  getAllProvoletaKeys().forEach(remove);
}

// ── Config (cadastros globais) ──

export function getConfig() {
  return load(KEYS.CONFIG, {
    categories: [],
    flavors: [],
    drinks: [],
    neighborhoods: [],
    motoboys: [],
    channels: [],
  });
}

export function saveConfig(config) {
  save(KEYS.CONFIG, config);
}

// ── Preferências locais do admin (pré-preenchem exportação do JSON público) ──

export function getSettings() {
  const defaults = {
    storeName: 'Pizzaria Provoleta',
    whatsapp: DEFAULT_WHATSAPP_FORMATTED,
    welcomeMessage: 'Monte seu pedido e envie direto pelo WhatsApp!',
    openHours: 'Seg a Dom · 18h às 23h',
  };
  const saved = load(KEYS.SETTINGS, null);
  if (!saved) return defaults;
  return {
    ...defaults,
    ...saved,
    whatsapp: saved.whatsapp?.trim() ? saved.whatsapp : defaults.whatsapp,
  };
}

export function saveSettings(settings) {
  save(KEYS.SETTINGS, settings);
}

// ── Meta (referência de mês, contadores) ──

export function getMeta() {
  return load(KEYS.META, {
    referenceMonth: null,
    orderCounters: {},
    initialized: false,
  });
}

export function saveMeta(meta) {
  save(KEYS.META, meta);
}

// ── Pedidos mensais ──

export function getOrders(year, month) {
  return load(monthKey('pedidos', year, month), []);
}

export function saveOrders(year, month, orders) {
  save(monthKey('pedidos', year, month), orders);
}

// ── Caixa mensal ──

export function getCashflow(year, month) {
  return load(monthKey('caixa', year, month), { expenses: [] });
}

export function saveCashflow(year, month, data) {
  save(monthKey('caixa', year, month), data);
}

// ── Estoque (global) ──

export function getInventory() {
  return load(KEYS.ESTOQUE, { items: [] });
}

export function saveInventory(data) {
  save(KEYS.ESTOQUE, data);
}

// ── Próximo número de pedido (sequencial por mês) ──

export function getNextOrderNumber(year, month) {
  const meta = getMeta();
  const key = `${year}_${String(month).padStart(2, '0')}`;
  const current = meta.orderCounters[key] || 0;
  const next = current + 1;
  meta.orderCounters[key] = next;
  saveMeta(meta);
  return next;
}

/** Próximo número sem incrementar (apenas exibição) */
export function peekNextOrderNumber(year, month) {
  const meta = getMeta();
  const key = `${year}_${String(month).padStart(2, '0')}`;
  return (meta.orderCounters[key] || 0) + 1;
}

/** Sincroniza contador se número manual for maior */
export function syncOrderCounter(year, month, number) {
  const meta = getMeta();
  const key = `${year}_${String(month).padStart(2, '0')}`;
  const num = parseInt(number, 10);
  if (!isNaN(num) && num > (meta.orderCounters[key] || 0)) {
    meta.orderCounters[key] = num;
    saveMeta(meta);
  }
}

// ── Backup completo ──

export function exportAllData() {
  const data = { version: VERSION, app: 'Pizzaria Provoleta', exportedAt: new Date().toISOString(), storage: {} };
  getAllProvoletaKeys().forEach((key) => {
    data.storage[key] = load(key);
  });
  return data;
}

/** Valida e restaura backup */
export function importAllData(backup) {
  if (!backup || typeof backup !== 'object') return { ok: false, error: 'Arquivo inválido: formato não reconhecido.' };
  if (backup.app !== 'Pizzaria Provoleta') return { ok: false, error: 'Este arquivo não é um backup legítimo do sistema Provoleta.' };
  if (!backup.storage || typeof backup.storage !== 'object') return { ok: false, error: 'Estrutura de backup corrompida: campo "storage" ausente.' };

  const keys = Object.keys(backup.storage);
  if (keys.length === 0) return { ok: false, error: 'Backup vazio — nenhum dado encontrado.' };

  const validPrefix = keys.every((k) => k.startsWith(PREFIX));
  if (!validPrefix) return { ok: false, error: 'Backup contém chaves inválidas.' };

  clearAll();
  keys.forEach((key) => save(key, backup.storage[key]));
  return { ok: true };
}

/** Lista todos os meses com dados (pedidos ou caixa) */
export function getAvailableMonths() {
  const months = new Set();
  getAllProvoletaKeys().forEach((key) => {
    const match = key.match(/provoleta_(?:pedidos|caixa)_(\d{4})_(\d{2})/);
    if (match) months.add(`${match[1]}-${match[2]}`);
  });
  return Array.from(months).sort();
}

/** Agrega pedidos de todos os meses */
export function getAllOrders() {
  const all = [];
  getAllProvoletaKeys().forEach((key) => {
    if (key.includes('_pedidos_')) {
      const orders = load(key, []);
      const match = key.match(/pedidos_(\d{4})_(\d{2})/);
      if (match) {
        orders.forEach((o) => all.push({ ...o, _year: match[1], _month: match[2] }));
      }
    }
  });
  return all;
}

/** Agrega despesas de todos os meses */
export function getAllExpenses() {
  const all = [];
  getAllProvoletaKeys().forEach((key) => {
    if (key.includes('_caixa_')) {
      const cf = load(key, { expenses: [] });
      const match = key.match(/caixa_(\d{4})_(\d{2})/);
      if (match && cf.expenses) {
        cf.expenses.forEach((e) => all.push({ ...e, _year: match[1], _month: match[2] }));
      }
    }
  });
  return all;
}

/** Calcula faturamento de pedidos válidos (não cancelados) */
export function calcMonthRevenue(year, month) {
  const orders = getOrders(year, month);
  return orders
    .filter((o) => o.status !== 'cancelado')
    .reduce((sum, o) => sum + (o.total || 0), 0);
}

export { VERSION, PREFIX };
