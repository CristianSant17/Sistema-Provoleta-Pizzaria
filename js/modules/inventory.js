/**
 * PROVOLETA — Gerenciamento de Estoque
 * CRUD completo + movimentações de entrada/saída.
 */

import { getInventory, saveInventory } from '../storage.js';
import { uid, escapeHtml, parseMoney } from '../utils.js';
import { toast, confirmModal, emptyState, tableActions, openFormModal } from '../ui.js';

const UNITS = ['KG', 'Unid', 'Litro'];

export function renderInventoryPage(container) {
  const inventory = getInventory();
  const items = inventory.items || [];

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Estoque de Insumos</h1>
      <p class="page-header__subtitle">Controle de insumos, embalagens e materiais</p>
    </div>

    <div class="card" style="margin-bottom:1.5rem">
      <div class="card__header"><h3 class="card__title">Adicionar Item</h3></div>
      <form id="inventoryForm">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Item</label>
            <input class="form-input" name="name" required placeholder="Ex: Mussarela">
          </div>
          <div class="form-group">
            <label class="form-label">Unidade</label>
            <select class="form-select" name="unit" required>
              ${UNITS.map((u) => `<option value="${u}">${u}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Estoque Mínimo (Alerta)</label>
            <input class="form-input" name="minStock" type="number" step="0.01" min="0" required>
          </div>
          <div class="form-group">
            <label class="form-label">Estoque Inicial</label>
            <input class="form-input" name="initialStock" type="number" step="0.01" min="0" required>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn--primary">+ Adicionar Item</button>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="card__header"><h3 class="card__title">Controle de Estoque</h3></div>
      <div id="inventoryTable">
        ${items.length ? renderInventoryTable(items) : emptyState('📦', 'Nenhum item no estoque')}
      </div>
    </div>
  `;

  container.querySelector('#inventoryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const inv = getInventory();
    inv.items = inv.items || [];
    inv.items.push({
      id: uid(), name: fd.get('name').trim(), unit: fd.get('unit'),
      minStock: parseMoney(fd.get('minStock')), initialStock: parseMoney(fd.get('initialStock')),
      entries: 0, exits: 0,
    });
    saveInventory(inv);
    toast('Item adicionado!', 'success');
    renderInventoryPage(container);
  });

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const inv = getInventory();

    if (btn.dataset.editItem) {
      const item = inv.items.find((i) => i.id === btn.dataset.editItem);
      if (!item) return;
      openFormModal({
        title: 'Editar Item de Estoque',
        formHtml: `
          <div class="form-grid">
            <div class="form-group form-group--full"><label class="form-label">Item</label>
              <input class="form-input" name="name" value="${escapeHtml(item.name)}" required></div>
            <div class="form-group"><label class="form-label">Unidade</label>
              <select class="form-select" name="unit" required>
                ${UNITS.map((u) => `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('')}
              </select></div>
            <div class="form-group"><label class="form-label">Estoque Mínimo</label>
              <input class="form-input" name="minStock" type="number" step="0.01" value="${item.minStock}" required></div>
            <div class="form-group"><label class="form-label">Estoque Inicial</label>
              <input class="form-input" name="initialStock" type="number" step="0.01" value="${item.initialStock}" required></div>
            <div class="form-group"><label class="form-label">Entradas (+)</label>
              <input class="form-input" name="entries" type="number" step="0.01" min="0" value="${item.entries}"></div>
            <div class="form-group"><label class="form-label">Saídas (-)</label>
              <input class="form-input" name="exits" type="number" step="0.01" min="0" value="${item.exits}"></div>
          </div>
          <p class="form-hint" style="margin-top:0.75rem">Atual: ${calcCurrent(item)} ${item.unit}</p>`,
        onSubmit: (_, fd) => {
          item.name = fd.get('name').trim();
          item.unit = fd.get('unit');
          item.minStock = parseMoney(fd.get('minStock'));
          item.initialStock = parseMoney(fd.get('initialStock'));
          item.entries = parseMoney(fd.get('entries'));
          item.exits = parseMoney(fd.get('exits'));
          saveInventory(inv);
          toast('Item atualizado!', 'success');
          renderInventoryPage(container);
        },
      });
      return;
    }

    if (btn.dataset.deleteItem) {
      if (!await confirmModal({ title: 'Excluir Item', message: 'Confirma a exclusão?', danger: true })) return;
      inv.items = inv.items.filter((i) => i.id !== btn.dataset.deleteItem);
      saveInventory(inv);
      toast('Item excluído.', 'info');
      renderInventoryPage(container);
      return;
    }

    const itemId = btn.dataset.itemId;
    const action = btn.dataset.action;
    if (!itemId || !action) return;

    const item = inv.items.find((i) => i.id === itemId);
    if (!item) return;

    const input = container.querySelector(`[data-input="${itemId}"]`);
    const qty = parseMoney(input?.value) || 0;
    if (qty <= 0) { toast('Informe uma quantidade válida.', 'error'); return; }

    if (action === 'entry') item.entries += qty;
    else if (action === 'exit') item.exits += qty;

    saveInventory(inv);
    toast(action === 'entry' ? 'Entrada registrada!' : 'Saída registrada!', 'success');
    renderInventoryPage(container);
  });
}

function calcCurrent(item) {
  return (item.initialStock || 0) + (item.entries || 0) - (item.exits || 0);
}

function renderInventoryTable(items) {
  return `
    <div class="table-wrapper"><table class="data-table">
      <thead><tr>
        <th>Item</th><th>Unidade</th><th>Mínimo</th><th>Inicial</th>
        <th>Entradas (+)</th><th>Saídas (-)</th><th>Atual</th><th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>${items.map((item) => {
        const current = calcCurrent(item);
        const alert = current <= item.minStock;
        return `<tr class="${alert ? 'row--alert' : ''}">
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td>${item.unit}</td>
          <td>${item.minStock}</td>
          <td>${item.initialStock}</td>
          <td>${item.entries}</td>
          <td>${item.exits}</td>
          <td><strong>${current}</strong></td>
          <td>${alert ? '<span class="tag tag--alert">RECOMPRAR</span>' : '<span class="tag tag--ok">OK</span>'}</td>
          <td>
            <div class="estoque-actions">
              <input class="table-input" data-input="${item.id}" type="number" step="0.01" min="0" placeholder="Qtd">
              <button type="button" class="btn btn--success btn--sm" data-item-id="${item.id}" data-action="entry">+</button>
              <button type="button" class="btn btn--secondary btn--sm" data-item-id="${item.id}" data-action="exit">−</button>
              <button type="button" class="btn btn--edit btn--sm" data-edit-item="${item.id}">Editar</button>
              <button type="button" class="btn btn--danger btn--sm" data-delete-item="${item.id}">✕</button>
            </div>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>`;
}
