/**
 * PROVOLETA — Dados iniciais de exemplo (deletáveis)
 * O sistema inicia limpo exceto por 2-3 exemplos visuais.
 */

import { uid } from './utils.js';
import { getMeta, saveMeta, saveConfig, saveSettings, saveInventory } from './storage.js';
import { PUBLIC_MENU_FILE } from './constants.js';
import { normalizePublicMenu } from './public-menu.js';

async function loadPublicMenuSeed() {
  try {
    const response = await fetch(`${PUBLIC_MENU_FILE}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Arquivo não encontrado');
    const raw = await response.json();
    const menu = normalizePublicMenu(raw);
    if (!menu) throw new Error('JSON inválido');

    return {
      config: {
        categories: menu.categories || [],
        flavors: menu.flavors || [],
        drinks: menu.drinks || [],
        neighborhoods: menu.neighborhoods || [],
        motoboys: menu.motoboys || [],
        channels: menu.channels || [],
        additionals: menu.additionals || [],
        coupons: menu.coupons || [],
      },
      settings: menu.store || {},
    };
  } catch {
    return null;
  }
}

export async function seedIfNeeded() {
  const meta = getMeta();
  if (meta.initialized) return;

  const publicSeed = await loadPublicMenuSeed();
  const config = publicSeed?.config ?? {
    categories: [
      { id: '1782982685193_jy1fc2m', name: 'Tradicional', priceP: 32, priceM: 42, priceG: 52 },
      { id: '1782982685193_ziws1wu', name: 'Premium', priceP: 38, priceM: 48, priceG: 58 },
      { id: 'seed_cat_doces', name: 'Doces', priceP: 28, priceM: 36, priceG: 44 },
    ],
    flavors: [
      { id: '1782982720170_30kqug9', name: 'Calabresa', categoryId: '1782982685193_jy1fc2m', imageUrl: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=800&q=80', extraImages: [], ingredients: ['mussarela','calabresa','cebola'] },
      { id: 'seed_frango_01', name: 'Frango', categoryId: '1782982685193_jy1fc2m', imageUrl: 'https://images.unsplash.com/photo-1604908177522-2d4bdc9b6b40?auto=format&fit=crop&w=800&q=80', extraImages: [], ingredients: ['mussarela','frango','cebola'] },
      { id: 'seed_frango_catupiry_01', name: 'Frango Catupiry', categoryId: '1782982685193_jy1fc2m', imageUrl: 'https://images.unsplash.com/photo-1546069901-eacef0df6022?auto=format&fit=crop&w=800&q=80', extraImages: [], ingredients: ['mussarela','frango','catupiry'] },
      { id: 'seed_mussarela_01', name: 'Mussarela', categoryId: '1782982685193_jy1fc2m', imageUrl: 'https://images.unsplash.com/photo-1542281286-9e0a16bb7366?auto=format&fit=crop&w=800&q=80', extraImages: [], ingredients: ['mussarela'] },
      { id: 'seed_camarao_01', name: 'Camarão', categoryId: '1782982685193_ziws1wu', imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', extraImages: [], ingredients: ['mussarela','camarao','alho'] },
      { id: 'seed_atum_01', name: 'Atum', categoryId: '1782982685193_ziws1wu', imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80', extraImages: [], ingredients: ['mussarela','atum','cebola'] },
      { id: 'seed_banana_choco_01', name: 'Banana com Chocolate', categoryId: 'seed_cat_doces', imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', extraImages: [], ingredients: ['banana','chocolate','leite condensado'] },
      { id: 'seed_brigadeiro_01', name: 'Brigadeiro', categoryId: 'seed_cat_doces', imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', extraImages: [], ingredients: ['brigadeiro','mussarela','granulado'] },
    ],
    drinks: [
      { id: '1782982685193_lxdmsq0', name: 'Coca-Cola', priceLata: 6, price1L: 10, imageUrl: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=800&q=80' },
      { id: 'seed_pepsi_01', name: 'Pepsi', priceLata: 6, price1L: 10, imageUrl: 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=800&q=80' },
    ],
    neighborhoods: [
      { id: uid(), name: 'Centro', fee: 5 },
      { id: uid(), name: 'Jardim América', fee: 8 },
    ],
    motoboys: [
      { id: 'seed_motoboy_01', name: 'Cristian', active: true },
    ],
    channels: [
      { id: 'seed_channel_whatsapp', name: 'WhatsApp' },
      { id: 'seed_channel_ifood', name: 'iFood' },
    ],
    additionals: [
      { id: uid(), name: 'Borda de Catupiry', price: 8 },
      { id: uid(), name: 'Queijo Extra', price: 5 },
      { id: uid(), name: 'Bacon', price: 6 },
    ],
    coupons: [
      { id: 'seed_coupon_verao10', code: 'VERAO10', active: true, description: '10% de desconto em pedidos a partir de R$50', type: 'percent', value: 10, minOrderValue: 50, productIds: [], expiresAt: null, freeShipping: false },
      { id: 'seed_coupon_frete', code: 'FRETEGRATIS', active: true, description: 'Frete grátis para pedidos acima de R$30', type: null, value: null, minOrderValue: 30, productIds: [], expiresAt: null, freeShipping: true },
      { id: 'seed_coupon_doces5', code: 'DOCES5', active: true, description: 'R$5 off em sobremesas selecionadas', type: 'fixed', value: 5, minOrderValue: 0, productIds: ['seed_banana_choco_01','seed_brigadeiro_01'], expiresAt: null, freeShipping: false },
    ],
  };

  if (publicSeed?.settings) {
    saveSettings({
      storeName: publicSeed.settings.storeName || publicSeed.settings.name || 'Pizzaria Provoleta',
      whatsapp: publicSeed.settings.whatsapp || publicSeed.settings.phone || '',
      welcomeMessage: publicSeed.settings.welcomeMessage || '',
      openHours: publicSeed.settings.openHours || '',
    });
  }

  saveConfig(config);

  const inventory = {
    items: [
      { id: uid(), name: 'Mussarela', unit: 'KG', minStock: 5, initialStock: 10, entries: 0, exits: 0 },
      { id: uid(), name: 'Embalagem M', unit: 'Unid', minStock: 20, initialStock: 50, entries: 0, exits: 0 },
      { id: uid(), name: 'Sacolas', unit: 'Unid', minStock: 30, initialStock: 100, entries: 0, exits: 0 },
    ],
  };

  saveInventory(inventory);

  meta.initialized = true;
  saveMeta(meta);
}
