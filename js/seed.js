/**
 * PROVOLETA — Dados iniciais de exemplo (deletáveis)
 * O sistema inicia limpo exceto por 2-3 exemplos visuais.
 */

import { uid } from './utils.js';
import { getMeta, saveMeta, saveConfig, saveInventory } from './storage.js';

export function seedIfNeeded() {
  const meta = getMeta();
  if (meta.initialized) return;

  const catId = uid();
  const catId2 = uid();

  const config = {
    categories: [
      { id: catId, name: 'Tradicional', priceP: 32, priceM: 42, priceG: 52 },
      { id: catId2, name: 'Premium', priceP: 38, priceM: 48, priceG: 58 },
    ],
    flavors: [
      { id: uid(), name: 'Calabresa', categoryId: catId, imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80' },
      { id: uid(), name: 'Quatro Queijos', categoryId: catId2, imageUrl: 'https://images.unsplash.com/photo-1548365328-8c6db3220e4c?auto=format&fit=crop&w=800&q=80' },
    ],
    drinks: [
      { id: uid(), name: 'Coca-Cola', priceLata: 6, price1L: 10, imageUrl: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=800&q=80' },
    ],
    neighborhoods: [
      { id: uid(), name: 'Centro', fee: 5 },
      { id: uid(), name: 'Jardim América', fee: 8 },
    ],
    motoboys: [
      { id: uid(), name: 'Carlos', active: true },
    ],
    channels: [
      { id: uid(), name: 'WhatsApp' },
      { id: uid(), name: 'iFood' },
    ],
    additionals: [
      { id: uid(), name: 'Borda de Catupiry', price: 8 },
      { id: uid(), name: 'Queijo Extra', price: 5 },
      { id: uid(), name: 'Bacon', price: 6 },
    ],
  };

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
