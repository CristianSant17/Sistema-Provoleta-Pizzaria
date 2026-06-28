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
      { id: uid(), name: 'Calabresa', categoryId: catId },
      { id: uid(), name: 'Quatro Queijos', categoryId: catId2 },
    ],
    drinks: [
      { id: uid(), name: 'Coca-Cola', priceLata: 6, price1L: 10 },
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
