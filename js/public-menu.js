/**
 * PROVOLETA — Cardápio público (JSON)
 * Fonte única da página pedido.html · gerado no admin e publicado via GitHub.
 */

import { PUBLIC_MENU_SCHEMA, DEFAULT_WHATSAPP_FORMATTED } from './constants.js';

/** Monta o objeto cardapio_publico.json a partir dos cadastros locais */
export function buildPublicMenu(config, storeSettings) {
  return {
    schema: PUBLIC_MENU_SCHEMA,
    version: '1.0.0',
    publishedAt: new Date().toISOString(),
    store: {
      name: storeSettings.storeName?.trim() || 'Pizzaria Provoleta',
      whatsapp: storeSettings.whatsapp?.trim() || DEFAULT_WHATSAPP_FORMATTED,
      welcomeMessage: storeSettings.welcomeMessage?.trim() || 'Monte seu pedido e envie pelo WhatsApp!',
      openHours: storeSettings.openHours?.trim() || '',
    },
    categories: (config.categories || []).map(({ id, name, priceP, priceM, priceG }) => ({
      id, name, priceP, priceM, priceG,
    })),
    flavors: (config.flavors || []).map(({ id, name, categoryId }) => ({ id, name, categoryId })),
    drinks: (config.drinks || []).map(({ id, name, priceLata, price1L }) => ({
      id, name, priceLata, price1L,
    })),
    neighborhoods: (config.neighborhoods || []).map(({ id, name, fee }) => ({ id, name, fee })),
  };
}

/** Valida estrutura do JSON público */
export function validatePublicMenu(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Arquivo inválido ou vazio.' };
  }
  if (data.schema !== PUBLIC_MENU_SCHEMA) {
    return { ok: false, error: `Schema inválido. Esperado: "${PUBLIC_MENU_SCHEMA}".` };
  }
  if (!data.store?.name) {
    return { ok: false, error: 'Campo "store.name" ausente.' };
  }
  if (!data.store?.whatsapp) {
    return { ok: false, error: 'Campo "store.whatsapp" ausente.' };
  }
  const hasItems = (data.flavors?.length > 0) || (data.drinks?.length > 0);
  if (!hasItems) {
    return { ok: false, error: 'Cardápio sem sabores ou bebidas.' };
  }
  return { ok: true };
}

/** Normaliza menu carregado (suporta schema legado plano) */
export function normalizePublicMenu(raw) {
  if (!raw || typeof raw !== 'object') return null;

  if (raw.schema === PUBLIC_MENU_SCHEMA && raw.store) {
    return {
      store: raw.store,
      categories: raw.categories || [],
      flavors: raw.flavors || [],
      drinks: raw.drinks || [],
      neighborhoods: raw.neighborhoods || [],
      publishedAt: raw.publishedAt,
    };
  }

  if (raw.flavors?.length || raw.drinks?.length) {
    return {
      store: {
        name: raw.storeName || raw.store?.name || 'Pizzaria Provoleta',
        whatsapp: raw.whatsapp || raw.store?.whatsapp || DEFAULT_WHATSAPP_FORMATTED,
        welcomeMessage: raw.welcomeMessage || raw.store?.welcomeMessage || '',
        openHours: raw.openHours || raw.store?.openHours || '',
      },
      categories: raw.categories || [],
      flavors: raw.flavors || [],
      drinks: raw.drinks || [],
      neighborhoods: raw.neighborhoods || [],
      publishedAt: raw.publishedAt,
    };
  }

  return null;
}
