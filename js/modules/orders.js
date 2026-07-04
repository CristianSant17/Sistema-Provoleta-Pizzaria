/**
 * PROVOLETA — Módulo de Lançamento de Pedidos
 * CRUD completo com formulário blindado e edição via modal.
 */

import {
  getConfig, getOrders, saveOrders, peekNextOrderNumber,
  syncOrderCounter, calcMonthRevenue, getMeta,
} from '../storage.js';
import {
  uid, formatMoney, nowDatetimeLocal, datetimeLocalToISO, isoToDatetimeLocal,
  formatDateTime, escapeHtml, paymentLabel, sizeLabel, parseMoney,
  getPizzaSizeRules, getPizzaFractionLabel, getPizzaSelectionStatus, normalizePizzaFlavorEntries,
  calculatePizzaPrice, calculateOrderItemPrice, calculateOrderTotal, buildOrderItemName, statusLabel, downloadJSON,
  currentMonthRef, parseMonthRef,
} from '../utils.js';
import { toast, confirmModal, renderPagination, statusTag, emptyState, tableActions, openFormModal } from '../ui.js';

const PAGE_SIZE = 10;
const QUICK_ORDER_STORAGE_KEY = 'provoleta_quick_order_defaults';
const ORDER_STATUSES = [
  { id: 'pendente', label: 'Pendente' },
  { id: 'em_preparo', label: 'Em preparo' },
  { id: 'entregue', label: 'Entregue' },
  { id: 'cancelado', label: 'Cancelado' },
];

let listState = {
  page: 1,
  search: '',
  itemType: '',
  status: '',
  motoboy: '',
  payment: '',
  deliveryMode: '',
  dateMode: 'none',
  dateValue: '',
};

function getOrderItemsFromOrder(order) {
  if (!order) return [];
  if (Array.isArray(order.items) && order.items.length) {
    return order.items.map((item) => ({
      type: item.type || 'pizza',
      itemId: item.itemId || item.id || '',
      itemName: item.itemName || item.name || '',
      size: item.size || '',
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice) || 0,
      flavors: Array.isArray(item.flavors) ? item.flavors : [],
      additionals: Array.isArray(item.additionals) ? item.additionals : [],
    }));
  }
  if (order?.itemId) {
    return [{
      type: order.type || 'pizza',
      itemId: order.itemId,
      itemName: order.itemName || '',
      size: order.size || '',
      quantity: Number(order.quantity) || 1,
      unitPrice: Number(order.unitPrice) || 0,
      flavors: Array.isArray(order.flavors) ? order.flavors : [],
      additionals: Array.isArray(order.additionalIds) ? order.additionalIds : [],
    }];
  }
  return [];
}

function getPizzaFlavorEntriesFromOrder(order) {
  const sourceItem = (Array.isArray(order?.items) && order.items.length)
    ? order.items.find((item) => item.type === 'pizza') || order.items[0]
    : order;
  if (Array.isArray(sourceItem?.flavors) && sourceItem.flavors.length) {
    const size = sourceItem?.size || '';
    const normalized = size ? normalizePizzaFlavorEntries(size, sourceItem.flavors) : sourceItem.flavors.map((entry) => ({
      id: entry.id || '',
      name: entry.name || entry.label || '',
      fraction: 1 / sourceItem.flavors.length,
      fractionLabel: getPizzaFractionLabel(1 / sourceItem.flavors.length),
    }));

    return normalized.map((entry, index) => ({
      id: sourceItem.flavors[index]?.id || entry.id,
      name: sourceItem.flavors[index]?.name || entry.name,
      fraction: entry.fraction,
      fractionLabel: entry.fractionLabel,
    }));
  }
  if (sourceItem?.type === 'pizza' && sourceItem?.itemId) {
    return [{
      id: sourceItem.itemId,
      name: sourceItem.itemName || sourceItem.name || '',
      fraction: 1,
      fractionLabel: '1/1',
    }];
  }
  return [];
}

function buildOrderItemsSummary(items = []) {
  if (!Array.isArray(items) || !items.length) return '';
  return items.map((item) => {
    const label = item.itemName || item.name || '';
    const size = item.size ? ` ${sizeLabel(item.size)}` : '';
    return `${item.quantity}x ${label}${size}`;
  }).join(' + ');
}

function downloadCSV(rows, filename = 'pedidos.csv') {
  const csv = rows.map((row) => Object.values(row).map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function getOrderMetrics(orders) {
  const pending = orders.filter((o) => o.status === 'pendente').length;
  const preparing = orders.filter((o) => o.status === 'em_preparo').length;
  const delivered = orders.filter((o) => o.status === 'entregue').length;
  const canceled = orders.filter((o) => o.status === 'cancelado').length;
  const pizzas = orders.filter((o) => o.type === 'pizza').length;
  const drinks = orders.filter((o) => o.type === 'bebida').length;
  return { pending, preparing, delivered, canceled, pizzas, drinks, total: orders.length };
}

function getCurrentOrderContext() {
  const meta = getMeta();
  const referenceMonth = meta.referenceMonth || currentMonthRef();
  return parseMonthRef(referenceMonth);
}

function ensureOrderIds(orders = []) {
  let updated = false;
  orders.forEach((order) => {
    if (!order.id) {
      order.id = uid();
      updated = true;
    } else if (typeof order.id !== 'string') {
      order.id = String(order.id);
      updated = true;
    }
  });
  return updated;
}

function emitOrdersUpdated(year, month) {
  window.dispatchEvent(new CustomEvent('provoleta.ordersUpdated', {
    detail: { year, month },
  }));
}

function getOrderDateKey(order) {
  const date = new Date(order.datetime);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekBounds(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function filterOrders(orders) {
  const search = listState.search?.trim().toLowerCase() || '';
  return orders.filter((o) => {
    const matchesType = !listState.itemType || o.type === listState.itemType;
    const matchesStatus = !listState.status || o.status === listState.status;
    const matchesMotoboy = !listState.motoboy || o.motoboyId === listState.motoboy;
    const matchesPayment = !listState.payment || o.paymentMethod === listState.payment;
    const matchesMode = !listState.deliveryMode || (o.deliveryMode || 'delivery') === listState.deliveryMode;

    let matchesDate = true;
    if (listState.dateMode !== 'none' && listState.dateValue) {
      const orderDate = new Date(o.datetime);
      if (!orderDate || Number.isNaN(orderDate.getTime())) {
        matchesDate = false;
      } else if (listState.dateMode === 'day') {
        const orderKey = getOrderDateKey(o);
        matchesDate = orderKey === listState.dateValue;
      } else if (listState.dateMode === 'week') {
        const bounds = getWeekBounds(listState.dateValue);
        matchesDate = bounds ? orderDate >= bounds.start && orderDate <= bounds.end : false;
      }
    }

    const valueMatch = !search || String(o.orderNumber).includes(search) || String(o.total).includes(search) || String(o.customerName || '').toLowerCase().includes(search) || String(o.customerPhone || '').toLowerCase().includes(search) || String(o.itemName || '').toLowerCase().includes(search);
    return matchesType && matchesStatus && matchesMotoboy && matchesPayment && matchesMode && matchesDate && valueMatch;
  });
}

function exportFilteredOrders(orders) {
  const rows = orders.map((o) => ({
    orderNumber: o.orderNumber,
    datetime: o.datetime,
    type: o.type,
    itemName: o.itemName,
    size: o.size,
    quantity: o.quantity,
    unitPrice: o.unitPrice,
    total: o.total,
    status: o.status,
    customerName: o.customerName || '',
    customerPhone: o.customerPhone || '',
    deliveryMode: o.deliveryMode,
  }));
  downloadCSV([Object.keys(rows[0] || {})].concat(rows));
}

function exportFilteredOrdersJSON(orders) {
  downloadJSON(orders, 'pedidos.json');
}

function readQuickOrderDefaults() {
  try {
    return JSON.parse(localStorage.getItem(QUICK_ORDER_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function serializePizzaFlavorEntries(entries = []) {
  const validEntries = (Array.isArray(entries) ? entries : []).filter((entry) => entry?.id);
  const fraction = validEntries.length ? 1 / validEntries.length : 0;
  return validEntries.map((entry) => ({
    id: entry.id,
    name: entry.name || entry.label || '',
    fraction,
    fractionLabel: getPizzaFractionLabel(fraction),
  }));
}

function saveQuickOrderDefaults(formEl) {
  const state = formEl._orderFormState;
  const payload = {
    itemType: formEl.querySelector('.item-type-btn.active')?.dataset.type || 'pizza',
    flavorId: formEl.querySelector('#flavorSelect')?.value || '',
    pizzaSize: formEl.querySelector('#pizzaSize')?.value || '',
    pizzaFlavorEntries: serializePizzaFlavorEntries(state?.getPizzaFlavorEntries ? state.getPizzaFlavorEntries() : []),
    drinkId: formEl.querySelector('#drinkSelect')?.value || '',
    drinkSize: formEl.querySelector('#drinkSize')?.value || '',
    quantity: formEl.querySelector('#quantity')?.value || '1',
    orderMode: formEl.querySelector('#orderMode')?.value || 'delivery',
    neighborhoodId: formEl.querySelector('#neighborhood')?.value || '',
    motoboyId: formEl.querySelector('#motoboy')?.value || '',
    channelId: formEl.querySelector('#channel')?.value || '',
    paymentMethod: formEl.querySelector('#payment')?.value || '',
    observations: formEl.querySelector('#observations')?.value || '',
  };
  localStorage.setItem(QUICK_ORDER_STORAGE_KEY, JSON.stringify(payload));
}

function setOrderFormType(formEl, itemType) {
  const buttons = formEl.querySelectorAll('.item-type-btn');
  buttons.forEach((btn) => {
    const isActive = btn.dataset.type === itemType;
    btn.classList.toggle('active', isActive);
    btn.classList.toggle('active--drink', isActive && itemType === 'bebida');
  });
  const pizzaFields = formEl.querySelector('#pizzaFields');
  const drinkFields = formEl.querySelector('#drinkFields');
  if (pizzaFields) pizzaFields.style.display = itemType === 'pizza' ? 'block' : 'none';
  if (drinkFields) drinkFields.style.display = itemType === 'bebida' ? 'block' : 'none';
}

function applyQuickOrderDefaults(formEl) {
  const defaults = readQuickOrderDefaults();
  if (!Object.keys(defaults).length) return;

  const itemType = defaults.itemType || 'pizza';
  setOrderFormType(formEl, itemType);

  if (itemType === 'pizza') {
    const pizzaSize = formEl.querySelector('#pizzaSize');
    if (pizzaSize) {
      pizzaSize.value = defaults.pizzaSize || '';
      pizzaSize.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const state = formEl._orderFormState;
    if (defaults.pizzaFlavorEntries?.length && state && typeof state.setPizzaFlavorEntries === 'function') {
      state.setPizzaFlavorEntries(serializePizzaFlavorEntries(defaults.pizzaFlavorEntries));
    }
  } else {
    const drinkSelect = formEl.querySelector('#drinkSelect');
    if (drinkSelect) {
      drinkSelect.value = defaults.drinkId || '';
      drinkSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const drinkSize = formEl.querySelector('#drinkSize');
    if (drinkSize) {
      drinkSize.value = defaults.drinkSize || '';
      drinkSize.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  const quantity = formEl.querySelector('#quantity');
  if (quantity) quantity.value = defaults.quantity || '1';

  const orderMode = formEl.querySelector('#orderMode');
  if (orderMode) {
    orderMode.value = defaults.orderMode || 'delivery';
    orderMode.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const channel = formEl.querySelector('#channel');
  if (channel) channel.value = defaults.channelId || '';
  const payment = formEl.querySelector('#payment');
  if (payment) payment.value = defaults.paymentMethod || '';
  const neighborhood = formEl.querySelector('#neighborhood');
  if (neighborhood) neighborhood.value = defaults.neighborhoodId || '';
  const motoboy = formEl.querySelector('#motoboy');
  if (motoboy) motoboy.value = defaults.motoboyId || '';
  const observations = formEl.querySelector('#observations');
  if (observations) observations.value = defaults.observations || '';

  const qtyInput = formEl.querySelector('#quantity');
  if (qtyInput) qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
}

function applyOrderTemplate(formEl, template, defaultOrderNum) {
  if (!template) return;

  const itemType = template.type || 'pizza';
  setOrderFormType(formEl, itemType);
  formEl.querySelector('#orderNumber').value = template.orderNumber || defaultOrderNum;
  formEl.querySelector('#orderDatetime').value = nowDatetimeLocal();
  formEl.querySelector('#quantity').value = template.quantity || 1;
  formEl.querySelector('#orderMode').value = template.deliveryMode === 'pickup' ? 'pickup' : 'delivery';
  formEl.querySelector('#channel').value = template.channelId || '';
  formEl.querySelector('#payment').value = template.paymentMethod || '';
  formEl.querySelector('#neighborhood').value = template.neighborhoodId || '';
  formEl.querySelector('#motoboy').value = template.motoboyId || '';
  formEl.querySelector('#observations').value = template.observations || '';

  if (itemType === 'pizza') {
    const size = template.size || '';
    const pizzaSize = formEl.querySelector('#pizzaSize');
    if (pizzaSize) {
      pizzaSize.value = size;
      pizzaSize.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const flavorEntries = Array.isArray(template.flavors) && template.flavors.length
      ? template.flavors.map((entry) => ({
          id: entry.id || '',
          name: entry.name || '',
          fraction: Number(entry.fraction) || 1,
          fractionLabel: entry.fractionLabel || getPizzaFractionLabel(Number(entry.fraction) || 1),
        }))
      : (template.itemId ? [{ id: template.itemId, name: template.itemName || '', fraction: 1, fractionLabel: '1/1' }] : []);

    const state = formEl._orderFormState;
    if (state && typeof state.setPizzaFlavorEntries === 'function') {
      state.setPizzaFlavorEntries(flavorEntries);
      formEl.querySelector('#pizzaSize').dispatchEvent(new Event('change', { bubbles: true }));
    }
  } else {
    formEl.querySelector('#drinkSelect').value = template.itemId || '';
    formEl.querySelector('#drinkSize').value = template.size || '';
    formEl.querySelector('#drinkSelect').dispatchEvent(new Event('change', { bubbles: true }));
    formEl.querySelector('#drinkSize').dispatchEvent(new Event('change', { bubbles: true }));
  }

  formEl.querySelector('#orderMode').dispatchEvent(new Event('change', { bubbles: true }));
  formEl.querySelector('#quantity').dispatchEvent(new Event('input', { bubbles: true }));
}

export function renderOrdersPage(container, { year, month }) {
  const config = getConfig();
  const orders = getOrders(year, month);
  if (ensureOrderIds(orders)) saveOrders(year, month, orders);
  const filteredOrders = filterOrders(orders);
  const revenue = calcMonthRevenue(year, month);
  const orderNum = peekNextOrderNumber(year, month);

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Lançamento de Pedidos</h1>
      <p class="page-header__subtitle">Operação rápida e blindada contra erros</p>
    </div>

    <div class="stat-card stat-card--hero">
      <div class="stat-card__label">Faturamento Total do Mês</div>
      <div class="stat-card__value">${formatMoney(revenue)}</div>
    </div>

    <div class="pedidos-layout">
      <div class="card pedido-form-card">
        <div class="card__header">
          <h3 class="card__title">Novo Pedido</h3>
          <div class="table-actions">
            <button type="button" class="btn btn--secondary btn--sm" id="resetOrderFormBtn">Limpar</button>
            <button type="button" class="btn btn--secondary btn--sm" id="duplicateLastOrderBtn">↺ Repetir último</button>
          </div>
        </div>
        <form id="orderForm">${buildOrderFormHTML(config, null, orderNum)}</form>
      </div>

      <div class="card pedido-metrics-card">
        <div class="pedido-metrics-grid">
          ${(() => {
            const metrics = getOrderMetrics(orders);
            return `
              <div class="metric-card">
                <span>Pedidos totais</span>
                <strong>${metrics.total}</strong>
              </div>
              <div class="metric-card">
                <span>Pendentes</span>
                <strong>${metrics.pending}</strong>
              </div>
              <div class="metric-card">
                <span>Em preparo</span>
                <strong>${metrics.preparing}</strong>
              </div>
              <div class="metric-card">
                <span>Entregues</span>
                <strong>${metrics.delivered}</strong>
              </div>
              <div class="metric-card">
                <span>Bebidas</span>
                <strong>${metrics.drinks}</strong>
              </div>
              <div class="metric-card">
                <span>Pizzas</span>
                <strong>${metrics.pizzas}</strong>
              </div>`;
          })()}
        </div>
      </div>

      <div class="card pedido-current-orders-card">
        <div class="card__header">
          <h3 class="card__title">Pedidos Recentes</h3>
          <div class="table-actions">
            <button type="button" class="btn btn--secondary btn--sm" id="showAllOrdersBtn">Ver todos</button>
          </div>
        </div>
        <div class="card__content">
          <div class="kanban-board">
            ${ORDER_STATUSES.map((status) => {
              const columnOrders = [...filteredOrders]
                .filter((o) => o.status === status.id)
                .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
              return `
                <div class="kanban-column" data-status="${status.id}">
                  <div class="kanban-column__header">
                    <div>
                      <h4>${status.label}</h4>
                      <div class="kanban-column__meta">${columnOrders.length} pedido${columnOrders.length === 1 ? '' : 's'}</div>
                    </div>
                    ${statusTag(status.id)}
                  </div>
                  <div class="kanban-column__body">
                    ${columnOrders.length ? columnOrders.map((o) => {
                      const orderItems = getOrderItemsFromOrder(o);
                      const detail = buildOrderItemsSummary(orderItems) || o.itemName || 'Sem itens';
                      const motoboy = config.motoboys.find((m) => m.id === o.motoboyId);
                      return `
                        <div class="kanban-card" draggable="true" data-order-id="${o.id}">
                          <div class="kanban-card__header">
                            <strong>#${o.orderNumber}</strong>
                            <span>${formatDateTime(o.datetime)}</span>
                          </div>
                          <div class="kanban-card__body">
                            <div class="kanban-card__text">${escapeHtml(detail)}</div>
                            <div class="kanban-card__text">${statusTag(o.status)} • ${paymentLabel(o.paymentMethod)} • ${formatMoney(o.total)} • ${escapeHtml((o.deliveryMode || 'delivery') === 'pickup' ? 'Retirada' : 'Entrega')}</div>
                            <div class="kanban-card__text">Motoboy: ${motoboy ? escapeHtml(motoboy.name) : '—'}</div>
                          </div>
                          <div class="kanban-card__actions">
                            <button type="button" class="btn btn--secondary btn--sm" data-set-status="${o.id}|pendente">Pendente</button>
                            <button type="button" class="btn btn--warning btn--sm" data-set-status="${o.id}|em_preparo">Em preparo</button>
                            <button type="button" class="btn btn--success btn--sm" data-set-status="${o.id}|entregue">Entregue</button>
                            <button type="button" class="btn btn--danger btn--sm" data-set-status="${o.id}|cancelado">Cancelar</button>
                            <button type="button" class="btn btn--edit btn--sm" data-edit-order="${o.id}">✎ Editar</button>
                          </div>
                        </div>`;
                    }).join('') : '<div class="kanban-column__empty">Nenhum pedido nesta coluna.</div>'}
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="card pedido-orders-table-card">
        <div class="card__header"><h3 class="card__title">Pedidos do Mês</h3></div>
        <div class="filters-bar">
          <div class="form-group">
            <label class="form-label">Buscar</label>
            <input class="form-input" id="filterSearch" type="search" placeholder="Número, cliente, telefone, item ou valor" value="${listState.search || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Tipo</label>
            <select class="form-select" id="filterType">
              <option value="">Todos</option>
              <option value="pizza">Pizza</option>
              <option value="bebida">Bebida</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="filterStatus">
              <option value="">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="em_preparo">Em preparo</option>
              <option value="entregue">Entregue</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Modo</label>
            <select class="form-select" id="filterMode">
              <option value="">Todos</option>
              <option value="delivery">Entrega</option>
              <option value="pickup">Retirada</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Filtro de data</label>
            <div class="form-grid">
              <select class="form-select" id="filterDateMode">
                <option value="none">Nenhum</option>
                <option value="day">Dia</option>
                <option value="week">Semana</option>
              </select>
              <input class="form-input" type="date" id="filterDateValue" ${listState.dateMode === 'none' ? 'disabled' : ''} value="${listState.dateValue || ''}">
            </div>
          </div>
          <div class="form-group form-group--inline">
            <button type="button" class="btn btn--secondary btn--sm" id="exportOrdersCsv">Exportar CSV</button>
            <button type="button" class="btn btn--secondary btn--sm" id="exportOrdersJson">Exportar JSON</button>
          </div>
        </div>
        <div id="ordersTableContainer"></div>
        <div id="ordersPagination"></div>
      </div>
    </div>
  `;

  bindOrderForm(container.querySelector('#orderForm'), config, null);
  bindOrderEvents(container, { year, month });
  renderOrdersTable(container, orders, config, { year, month });
}

/** HTML reutilizável do formulário de pedido (criar ou editar) */
function buildOrderFormHTML(config, order, defaultOrderNum) {
  const isEdit = !!order;
  const itemType = order?.type === 'bebida' ? 'bebida' : 'pizza';
  const dt = order ? isoToDatetimeLocal(order.datetime) : nowDatetimeLocal();
  const orderItems = getOrderItemsFromOrder(order);
  const initialPizzaFlavors = getPizzaFlavorEntriesFromOrder(order);
  const initialSize = order?.size || '';
  const defaultQuantity = 1;

  return `
    <div class="form-panel">
      <div class="form-panel__header">
        <div>
          <h4 class="form-panel__title">Dados básicos</h4>
          <p class="form-panel__hint">Número do pedido, horário e status da operação</p>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Nº do Pedido</label>
          <input class="form-input" id="orderNumber" type="number" min="1" value="${order?.orderNumber ?? defaultOrderNum}">
        </div>
        <div class="form-group">
          <label class="form-label">Data e Hora</label>
          <input class="form-input" id="orderDatetime" type="datetime-local" value="${dt}">
        </div>
        <div class="form-group">
          <label class="form-label">Nome do Cliente</label>
          <input class="form-input" id="customerName" type="text" value="${escapeHtml(order?.customerName || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Telefone</label>
          <input class="form-input" id="customerPhone" type="tel" value="${escapeHtml(order?.customerPhone || '')}">
        </div>
        ${isEdit ? `
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" id="orderStatus">
            <option value="pendente" ${order.status === 'pendente' ? 'selected' : ''}>Pendente</option>
            <option value="entregue" ${order.status === 'entregue' ? 'selected' : ''}>Entregue</option>
            <option value="cancelado" ${order.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </div>` : ''}
      </div>
    </div>

    <div class="section-divider"></div>

    <div class="form-panel">
      <div class="form-panel__header">
        <div>
          <h4 class="form-panel__title">Item do pedido</h4>
          <p class="form-panel__hint">Monte sabores por fração com validação automática</p>
        </div>
      </div>
      <label class="form-label">Tipo de Item</label>
      <div class="item-type-selector">
        <button type="button" class="item-type-btn ${itemType === 'pizza' ? 'active' : ''}" data-type="pizza">Pizza</button>
        <button type="button" class="item-type-btn ${itemType === 'bebida' ? 'active' : ''}" data-type="bebida">Bebida</button>
      </div>

      <div id="pizzaFields" style="display:${itemType === 'pizza' ? 'block' : 'none'}">
        <div class="form-group pizza-size-group">
          <label class="form-label">Tamanho</label>
          <select class="form-select" id="pizzaSize">
            <option value="">Selecione...</option>
            ${['P', 'M', 'G'].map((s) => `<option value="${s}" ${initialSize === s ? 'selected' : ''}>${sizeLabel(s)}</option>`).join('')}
          </select>
        </div>
        <div class="pizza-builder-panel">
          <div class="pizza-builder-hint" id="pizzaSelectionHint">${initialSize ? `Selecione até ${getPizzaSizeRules(initialSize).maxFlavors} sabores` : 'Selecione o tamanho para montar a pizza'}</div>
          <div id="pizzaFlavorRows"></div>
          <button type="button" class="btn btn--secondary btn--sm" id="addPizzaFlavorBtn" ${!initialSize ? 'disabled' : ''}>+ Adicionar sabor</button>
          <div class="pizza-builder-status" id="pizzaSelectionStatus">${initialSize ? 'Aguarde a montagem...' : 'Selecione o tamanho para continuar.'}</div>
        </div>
      </div>

      <div id="drinkFields" style="display:${itemType === 'bebida' ? 'block' : 'none'}">
        <div class="form-group" style="margin-bottom:0.75rem">
          <label class="form-label">Bebida</label>
          <select class="form-select" id="drinkSelect">
            <option value="">Selecione...</option>
            ${config.drinks.map((d) => `<option value="${d.id}" ${order?.itemId === d.id && itemType === 'bebida' ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0.75rem">
          <label class="form-label">Tamanho</label>
          <select class="form-select" id="drinkSize" ${!order?.itemId || itemType !== 'bebida' ? 'disabled' : ''}>
            <option value="">Selecione...</option>
            ${['Lata', '1L'].map((s) => `<option value="${s}" ${order?.size === s && itemType === 'bebida' ? 'selected' : ''}>${sizeLabel(s)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Quantidade</label>
          <input class="form-input" id="quantity" type="number" min="1" value="${defaultQuantity}">
        </div>
        <div class="form-group">
          <label class="form-label">Valor Unitário</label>
          <input class="form-input form-input--locked" id="unitPrice" readonly value="${formatMoney(0)}">
        </div>
      </div>
      <div class="form-group form-group--full">
        <div class="order-item-summary" id="orderItemSummary">Selecione o item para ver o resumo</div>
      </div>
      <button type="button" class="btn btn--secondary" id="addOrderItemBtn">${orderItems.length ? 'Adicionar item' : 'Confirmar item'}</button>
      <div class="form-group form-group--full">
        <label class="form-label">Itens adicionados</label>
        <div id="orderItemsList" class="order-items-list">
          ${orderItems.length ? orderItems.map((item, index) => `<div class="order-items-list__item" data-item-index="${index}">${escapeHtml(`${item.quantity}x ${item.itemName}${item.size ? ` ${sizeLabel(item.size)}` : ''}`)}</div>`).join('') : '<div class="order-items-empty">Nenhum item adicionado ainda.</div>'}
        </div>
      </div>
    </div>

    <div class="section-divider"></div>

    <div class="form-panel">
      <div class="form-panel__header">
        <div>
          <h4 class="form-panel__title">Entrega e pagamento</h4>
          <p class="form-panel__hint">Defina o canal, o modo e os dados de fechamento</p>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Modo de Pedido</label>
          <select class="form-select" id="orderMode">
            <option value="delivery" ${order?.deliveryMode !== 'pickup' ? 'selected' : ''}>Entrega</option>
            <option value="pickup" ${order?.deliveryMode === 'pickup' ? 'selected' : ''}>Retirada</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Canal de Venda</label>
          <select class="form-select" id="channel" required>
            <option value="">Selecione...</option>
            ${config.channels.map((c) => `<option value="${c.id}" ${order?.channelId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="neighborhoodGroup" style="display:${order?.deliveryMode === 'pickup' ? 'none' : 'block'}">
          <label class="form-label">Bairro</label>
          <select class="form-select" id="neighborhood">
            <option value="">Selecione...</option>
            ${config.neighborhoods.map((n) => `<option value="${n.id}" data-fee="${n.fee}" ${order?.neighborhoodId === n.id ? 'selected' : ''}>${escapeHtml(n.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="deliveryFeeGroup" style="display:${order?.deliveryMode === 'pickup' ? 'none' : 'block'}">
          <label class="form-label">Taxa de Entrega</label>
          <input class="form-input form-input--locked" id="deliveryFee" readonly value="${formatMoney(order?.deliveryFee ?? 0)}">
        </div>
        <div class="form-group" id="motoboyGroup" style="display:${order?.deliveryMode === 'pickup' ? 'none' : 'block'}">
          <label class="form-label">Motoboy</label>
          <select class="form-select" id="motoboy">
            <option value="">Selecione...</option>
            ${config.motoboys.filter((m) => m.active || order?.motoboyId === m.id).map((m) =>
              `<option value="${m.id}" ${order?.motoboyId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Forma de Pagamento</label>
          <select class="form-select" id="payment" required>
            <option value="">Selecione...</option>
            ${['dinheiro', 'pix', 'cartao'].map((p) =>
              `<option value="${p}" ${order?.paymentMethod === p ? 'selected' : ''}>${paymentLabel(p)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group form-group--full">
          <label class="form-label">Observações</label>
          <textarea class="form-textarea" id="observations">${escapeHtml(order?.observations ?? '')}</textarea>
        </div>
      </div>
    </div>

    <div class="pedido-total-display">
      <div class="pedido-total-display__label">Valor Total do Pedido</div>
      <div class="pedido-total-display__value" id="orderTotal">${formatMoney(order?.total ?? 0)}</div>
    </div>

    <div class="form-actions">
      <button type="submit" class="btn btn--warm" style="flex:1">${isEdit ? 'Salvar Alterações' : '✓ Lançar Pedido'}</button>
    </div>`;
}

/** Vincula lógica de cálculo ao formulário */
function bindOrderForm(formEl, config, order, onReady) {
  let itemType = order?.type || 'pizza';
  let currentUnitPrice = 0;
  let currentDeliveryFee = order?.deliveryFee || 0;
  let pizzaFlavorEntries = getPizzaFlavorEntriesFromOrder(order);
  let orderItems = getOrderItemsFromOrder(order);

  const els = {
    flavorSelect: formEl.querySelector('#flavorSelect'),
    pizzaSize: formEl.querySelector('#pizzaSize'),
    orderMode: formEl.querySelector('#orderMode'),
    drinkSelect: formEl.querySelector('#drinkSelect'),
    drinkSize: formEl.querySelector('#drinkSize'),
    quantity: formEl.querySelector('#quantity'),
    unitPrice: formEl.querySelector('#unitPrice'),
    customerName: formEl.querySelector('#customerName'),
    customerPhone: formEl.querySelector('#customerPhone'),
    orderItemSummary: formEl.querySelector('#orderItemSummary'),
    addOrderItemBtn: formEl.querySelector('#addOrderItemBtn'),
    orderItemsList: formEl.querySelector('#orderItemsList'),
    neighborhood: formEl.querySelector('#neighborhood'),
    neighborhoodGroup: formEl.querySelector('#neighborhoodGroup'),
    deliveryFee: formEl.querySelector('#deliveryFee'),
    deliveryFeeGroup: formEl.querySelector('#deliveryFeeGroup'),
    motoboy: formEl.querySelector('#motoboy'),
    motoboyGroup: formEl.querySelector('#motoboyGroup'),
    orderTotal: formEl.querySelector('#orderTotal'),
    pizzaFields: formEl.querySelector('#pizzaFields'),
    drinkFields: formEl.querySelector('#drinkFields'),
    pizzaFlavorRows: formEl.querySelector('#pizzaFlavorRows'),
    addPizzaFlavorBtn: formEl.querySelector('#addPizzaFlavorBtn'),
    pizzaSelectionHint: formEl.querySelector('#pizzaSelectionHint'),
    pizzaSelectionStatus: formEl.querySelector('#pizzaSelectionStatus'),
  };

  function renderPizzaFlavorRows() {
    if (!els.pizzaFlavorRows) return;
    const size = els.pizzaSize?.value || '';
    const rules = getPizzaSizeRules(size);

    if (!size) {
      els.pizzaFlavorRows.innerHTML = '';
      els.addPizzaFlavorBtn.disabled = true;
      els.pizzaSelectionHint.textContent = 'Selecione o tamanho para montar a pizza';
      els.pizzaSelectionStatus.textContent = 'Selecione o tamanho para continuar.';
      return;
    }

    const status = getPizzaSelectionStatus(size, pizzaFlavorEntries);
    const displayEntries = status.normalized.length ? status.normalized : pizzaFlavorEntries;
    els.pizzaSelectionHint.textContent = `Selecione até ${rules.maxFlavors} sabores`;
    els.pizzaSelectionStatus.textContent = status.message;
    els.addPizzaFlavorBtn.disabled = !size || pizzaFlavorEntries.length >= rules.maxFlavors;
    els.pizzaFlavorRows.innerHTML = displayEntries.map((entry, index) => {
      const options = config.flavors.map((f) => {
        const cat = config.categories.find((c) => c.id === f.categoryId);
        return `<option value="${f.id}" ${f.id === entry.id ? 'selected' : ''}>${escapeHtml(f.name)}${cat ? ` (${escapeHtml(cat.name)})` : ''}</option>`;
      }).join('');
      return `
        <div class="pizza-builder-row">
          <div class="form-group">
            <label class="form-label">Sabor ${index + 1}</label>
            <select class="form-select pizza-flavor-select" data-index="${index}">${options}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Fração</label>
            <div class="form-input form-input--locked">${entry.fractionLabel || '—'}</div>
          </div>
          <div class="form-group">
            <button type="button" class="btn btn--danger btn--sm pizza-remove-row" data-index="${index}">✕</button>
          </div>
        </div>`;
    }).join('');

    els.pizzaFlavorRows.querySelectorAll('.pizza-flavor-select').forEach((select) => {
      select.addEventListener('change', (event) => {
        const index = Number(event.target.dataset.index);
        const flavor = config.flavors.find((f) => f.id === event.target.value);
        pizzaFlavorEntries[index] = {
          ...pizzaFlavorEntries[index],
          id: flavor?.id || '',
          name: flavor?.name || '',
        };
        renderPizzaFlavorRows();
        updateUnitPrice();
      });
    });


    els.pizzaFlavorRows.querySelectorAll('.pizza-remove-row').forEach((button) => {
      button.addEventListener('click', (event) => {
        const index = Number(event.currentTarget.dataset.index);
        pizzaFlavorEntries.splice(index, 1);
        renderPizzaFlavorRows();
        updateUnitPrice();
      });
    });
  }

  function updateDeliveryModeUI() {
    const isDelivery = els.orderMode?.value === 'delivery';
    if (els.neighborhoodGroup) els.neighborhoodGroup.style.display = isDelivery ? 'block' : 'none';
    if (els.deliveryFeeGroup) els.deliveryFeeGroup.style.display = isDelivery ? 'block' : 'none';
    if (els.motoboyGroup) els.motoboyGroup.style.display = isDelivery ? 'block' : 'none';

    if (!isDelivery) {
      currentDeliveryFee = 0;
      if (els.neighborhood) els.neighborhood.value = '';
      if (els.motoboy) els.motoboy.value = '';
    } else {
      currentDeliveryFee = parseFloat(els.neighborhood?.selectedOptions[0]?.dataset.fee) || 0;
    }
    if (els.deliveryFee) els.deliveryFee.value = formatMoney(currentDeliveryFee);
    calcTotal();
  }

  function calcTotal() {
    const itemsTotal = orderItems.reduce((sum, item) => sum + ((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0)), 0);
    const total = itemsTotal + currentDeliveryFee;
    els.orderTotal.textContent = formatMoney(total);
    return total;
  }

  function updateOrderItemSummary() {
    const size = itemType === 'pizza' ? els.pizzaSize.value : els.drinkSize.value;
    const quantity = parseInt(els.quantity.value, 10) || 1;
    let summary = 'Selecione o item para ver o resumo';
    if (itemType === 'pizza' && size) {
      const status = getPizzaSelectionStatus(size, pizzaFlavorEntries);
      if (status.valid) {
        const itemName = buildOrderItemName({ type: 'pizza', size, flavors: status.normalized });
        summary = `${itemName} • ${formatMoney(currentUnitPrice)} • ${quantity}x`;
      } else {
        summary = status.message;
      }
    }
    if (itemType === 'bebida') {
      const drink = config.drinks.find((d) => d.id === els.drinkSelect.value);
      if (drink && els.drinkSize.value) {
        const itemName = buildOrderItemName({ type: 'bebida', size: els.drinkSize.value, itemName: drink.name });
        summary = `${itemName} • ${formatMoney(currentUnitPrice)} • ${quantity}x`;
      }
    }
    if (els.orderItemSummary) els.orderItemSummary.textContent = summary;
  }

  function buildCurrentOrderItem() {
    const quantity = parseInt(els.quantity.value, 10) || 1;
    if (itemType === 'pizza') {
      const size = els.pizzaSize.value;
      const status = getPizzaSelectionStatus(size, pizzaFlavorEntries);
      if (!size || !status.valid) {
        toast(status.message || 'Selecione os sabores antes de adicionar a pizza.', 'error');
        return null;
      }
      const flavors = status.normalized.filter((entry) => entry.id && Number(entry.fraction) > 0);
      if (!flavors.length) {
        toast('Adicione sabores válidos para a pizza.', 'error');
        return null;
      }
      const itemName = buildOrderItemName({ type: 'pizza', size, flavors });
      const unitPrice = calculateOrderItemPrice({
        type: 'pizza',
        size,
        flavors,
        additionals: [],
        flavorCatalog: config.flavors,
        categoryCatalog: config.categories,
      });
      return {
        type: 'pizza',
        itemId: flavors[0].id || '',
        itemName,
        size,
        quantity,
        unitPrice,
        flavors,
        additionals: [],
      };
    }

    const drink = config.drinks.find((d) => d.id === els.drinkSelect.value);
    if (!drink || !els.drinkSize.value) {
      toast('Selecione a bebida e o tamanho antes de adicionar o item.', 'error');
      return null;
    }
    const size = els.drinkSize.value;
    const itemName = buildOrderItemName({ type: 'bebida', size, itemName: drink.name });
    const unitPrice = calculateOrderItemPrice({
      type: 'bebida',
      size,
      itemId: drink.id,
      drinksCatalog: config.drinks,
    });
    return {
      type: 'bebida',
      itemId: drink.id,
      itemName,
      size,
      quantity,
      unitPrice,
      flavors: [],
      additionals: [],
    };
  }

  function renderOrderItemsList() {
    if (!els.orderItemsList) return;
    if (!orderItems.length) {
      els.orderItemsList.innerHTML = '<div class="order-items-empty">Nenhum item adicionado ainda.</div>';
      return;
    }
    els.orderItemsList.innerHTML = orderItems.map((item, index) => `
      <div class="order-items-list__item" data-item-index="${index}">
        <span>${escapeHtml(`${item.quantity}x ${item.itemName}${item.size ? ` ${sizeLabel(item.size)}` : ''}`)}</span>
        <button type="button" class="btn btn--danger btn--sm order-item-remove" data-index="${index}">Remover</button>
      </div>
    `).join('');
    els.orderItemsList.querySelectorAll('.order-item-remove').forEach((button) => {
      button.addEventListener('click', (event) => {
        const index = Number(event.currentTarget.dataset.index);
        orderItems.splice(index, 1);
        renderOrderItemsList();
        calcTotal();
      });
    });
  }

  function clearCurrentItemBuilder() {
    pizzaFlavorEntries = [];
    if (els.pizzaSize) els.pizzaSize.value = '';
    if (els.drinkSelect) els.drinkSelect.value = '';
    if (els.drinkSize) els.drinkSize.value = '';
    if (els.quantity) els.quantity.value = '1';
    if (els.drinkSize) els.drinkSize.disabled = true;
    if (els.pizzaSelectionHint) els.pizzaSelectionHint.textContent = 'Selecione o tamanho para montar a pizza';
    if (els.pizzaSelectionStatus) els.pizzaSelectionStatus.textContent = 'Selecione o tamanho para continuar.';
    renderPizzaFlavorRows();
    updateUnitPrice();
    updateOrderItemSummary();
  }

  function addCurrentItemToOrder() {
    const item = buildCurrentOrderItem();
    if (!item) return;
    orderItems.push(item);
    renderOrderItemsList();
    calcTotal();
    clearCurrentItemBuilder();
    toast(`Item ${item.itemName} adicionado ao pedido.`, 'success');
  }

  function updateUnitPrice() {
    currentUnitPrice = 0;
    if (itemType === 'pizza') {
      const size = els.pizzaSize.value;
      const normalizedFlavors = normalizePizzaFlavorEntries(size, pizzaFlavorEntries);
      if (size && normalizedFlavors.length && normalizedFlavors.every((entry) => entry.id)) {
        currentUnitPrice = calculateOrderItemPrice({
          type: 'pizza',
          size,
          flavors: normalizedFlavors,
          additionals: [],
          flavorCatalog: config.flavors,
          categoryCatalog: config.categories,
        });
      }
    } else {
      currentUnitPrice = calculateOrderItemPrice({
        type: 'bebida',
        size: els.drinkSize.value,
        itemId: els.drinkSelect.value,
        drinksCatalog: config.drinks,
      });
    }
    els.unitPrice.value = formatMoney(currentUnitPrice);
    calcTotal();
    updateOrderItemSummary();
  }

  formEl.querySelectorAll('.item-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      itemType = btn.dataset.type;
      formEl.querySelectorAll('.item-type-btn').forEach((b) => b.classList.toggle('active', b.dataset.type === itemType));
      els.pizzaFields.style.display = itemType === 'pizza' ? 'block' : 'none';
      els.drinkFields.style.display = itemType === 'bebida' ? 'block' : 'none';
      updateUnitPrice();
    });
  });

  els.pizzaSize?.addEventListener('change', () => {
    const size = els.pizzaSize.value;
    const rules = getPizzaSizeRules(size);
    if (!size) {
      pizzaFlavorEntries = [];
    } else {
      pizzaFlavorEntries = pizzaFlavorEntries.slice(0, rules.maxFlavors).map((entry) => ({
        id: entry.id || '',
        name: entry.name || '',
      }));
    }
    els.addPizzaFlavorBtn.disabled = !size;
    els.addPizzaFlavorBtn.textContent = '+ Adicionar sabor';
    els.pizzaSelectionHint.textContent = size ? `Selecione até ${rules.maxFlavors} sabores` : 'Selecione o tamanho para montar a pizza';
    renderPizzaFlavorRows();
    updateUnitPrice();
  });

  els.addPizzaFlavorBtn?.addEventListener('click', () => {
    const size = els.pizzaSize?.value;
    const rules = getPizzaSizeRules(size);
    if (!size || pizzaFlavorEntries.length >= rules.maxFlavors) return;
    pizzaFlavorEntries = [...pizzaFlavorEntries, { id: '', name: '' }];
    renderPizzaFlavorRows();
    updateUnitPrice();
  });
  els.drinkSelect?.addEventListener('change', () => {
    els.drinkSize.disabled = !els.drinkSelect.value;
    if (!els.drinkSelect.value) els.drinkSize.value = '';
    updateUnitPrice();
  });
  els.drinkSize?.addEventListener('change', updateUnitPrice);

  els.orderMode?.addEventListener('change', updateDeliveryModeUI);
  els.neighborhood?.addEventListener('change', () => {
    currentDeliveryFee = parseFloat(els.neighborhood.selectedOptions[0]?.dataset.fee) || 0;
    els.deliveryFee.value = formatMoney(currentDeliveryFee);
    calcTotal();
  });
  els.addOrderItemBtn?.addEventListener('click', addCurrentItemToOrder);
  els.quantity?.addEventListener('input', () => {
    calcTotal();
    updateOrderItemSummary();
  });

  const dtInput = formEl.querySelector('#orderDatetime');
  if (dtInput && !order) {
    dtInput.addEventListener('focus', function () { if (!this.dataset.edited) this.value = nowDatetimeLocal(); });
    dtInput.addEventListener('change', function () { this.dataset.edited = '1'; });
  }

  updateDeliveryModeUI();
  renderPizzaFlavorRows();
  updateUnitPrice();
  renderOrderItemsList();
  formEl._orderFormState = {
    getItemType: () => itemType,
    calcTotal,
    getPrices: () => ({ currentUnitPrice, currentDeliveryFee }),
    getPizzaFlavorEntries: () => pizzaFlavorEntries,
    setPizzaFlavorEntries: (entries) => { pizzaFlavorEntries = Array.isArray(entries) ? entries : []; renderPizzaFlavorRows(); updateUnitPrice(); },
    getOrderItems: () => orderItems,
    getCurrentOrderItem: buildCurrentOrderItem,
  };
  if (!order) applyQuickOrderDefaults(formEl);
  if (onReady) onReady();
}

function collectOrderData(formEl, config) {
  const state = formEl._orderFormState;
  const { currentDeliveryFee } = state.getPrices();
  const orderItems = state.getOrderItems ? state.getOrderItems() : [];
  const currentOrderItem = state.getCurrentOrderItem ? state.getCurrentOrderItem() : null;
  const builderHasItem = currentOrderItem && currentOrderItem.itemId;

  if (builderHasItem) {
    toast('Confirme o item criado antes de lançar o pedido.', 'error');
    return null;
  }

  if (!orderItems.length) {
    toast('Adicione pelo menos um item ao pedido antes de lançar.', 'error');
    return null;
  }
  const deliveryMode = formEl.querySelector('#orderMode').value;
  if (deliveryMode === 'delivery' && (!formEl.querySelector('#neighborhood').value || !formEl.querySelector('#motoboy').value)) {
    toast('Para entregas, selecione bairro e motoboy.', 'error'); return null;
  }
  if (!formEl.querySelector('#channel').value || !formEl.querySelector('#payment').value) {
    toast('Preencha todos os campos obrigatórios.', 'error'); return null;
  }

  const totalItems = orderItems.reduce((sum, item) => sum + ((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0)), 0);
  const total = totalItems + (deliveryMode === 'delivery' ? currentDeliveryFee : 0);

  const firstItem = orderItems[0] || {};
  const uniqueTypes = [...new Set(orderItems.map((item) => item.type))];
  const orderType = uniqueTypes.length === 1 ? uniqueTypes[0] : 'misto';
  const itemId = firstItem.itemId || '';
  const itemName = buildOrderItemsSummary(orderItems) || '';
  const size = firstItem.size || '';
  const categoryId = config.flavors.find((f) => f.id === itemId)?.categoryId || null;
  const flavors = orderItems.find((item) => item.type === 'pizza')?.flavors || [];
  const additionalIds = [];

  return {
    orderNumber: parseInt(formEl.querySelector('#orderNumber').value, 10),
    datetime: datetimeLocalToISO(formEl.querySelector('#orderDatetime').value),
    customerName: formEl.querySelector('#customerName')?.value.trim() || '',
    customerPhone: formEl.querySelector('#customerPhone')?.value.trim() || '',
    type: orderType,
    itemId,
    itemName,
    size,
    categoryId,
    quantity: orderItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    unitPrice: 0,
    flavors,
    additionalIds,
    items: orderItems,
    deliveryMode,
    neighborhoodId: deliveryMode === 'delivery' ? formEl.querySelector('#neighborhood').value : '',
    deliveryFee: deliveryMode === 'delivery' ? currentDeliveryFee : 0,
    channelId: formEl.querySelector('#channel').value,
    motoboyId: deliveryMode === 'delivery' ? formEl.querySelector('#motoboy').value : '',
    paymentMethod: formEl.querySelector('#payment').value,
    observations: formEl.querySelector('#observations').value.trim(),
    total,
    status: formEl.querySelector('#orderStatus')?.value || 'pendente',
  };
}

function bindOrderFormSubmit(container, ctx, existingOrder) {
  const form = container.querySelector('#orderForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { year, month } = ctx;
    const config = getConfig();
    const data = collectOrderData(form, config);
    if (!data) return;

    const orders = getOrders(year, month);

    if (existingOrder) {
      Object.assign(existingOrder, data);
      saveOrders(year, month, orders);
      syncOrderCounter(year, month, data.orderNumber);
      toast(`Pedido #${data.orderNumber} atualizado!`, 'success');
    } else {
      orders.push({ id: uid(), ...data, status: 'pendente' });
      saveOrders(year, month, orders);
      syncOrderCounter(year, month, data.orderNumber);
      saveQuickOrderDefaults(form);
      toast(`Pedido #${data.orderNumber} lançado!`, 'success');
      listState.page = 1;
    }
    renderOrdersPage(container, ctx);
  });
}

function openOrderEditModal(order, ctx, container) {
  const config = getConfig();
  openFormModal({
    title: `Editar Pedido #${order.orderNumber}`,
    wide: true,
    formHtml: buildOrderFormHTML(config, order, order.orderNumber),
    submitLabel: 'Salvar pedido',
    onSubmit: (form) => {
      const data = collectOrderData(form, config);
      if (!data) return false;

      const orders = getOrders(ctx.year, ctx.month);
      Object.assign(order, data);
      saveOrders(ctx.year, ctx.month, orders);
      syncOrderCounter(ctx.year, ctx.month, data.orderNumber);
      emitOrdersUpdated(ctx.year, ctx.month);
      toast(`Pedido #${data.orderNumber} atualizado!`, 'success');
      renderOrdersPage(container, ctx);
    },
  });

  const modalForm = document.querySelector('#editModalForm');
  if (modalForm) bindOrderForm(modalForm, config, order);
}

function renderOrdersTable(container, allOrders, config, ctx) {
  let filtered = filterOrders(allOrders);
  filtered.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (listState.page > totalPages) listState.page = totalPages;
  const pageOrders = filtered.slice((listState.page - 1) * PAGE_SIZE, listState.page * PAGE_SIZE);

  const tableContainer = container.querySelector('#ordersTableContainer');
  if (!filtered.length) {
    tableContainer.innerHTML = emptyState('📋', 'Nenhum pedido neste mês');
    container.querySelector('#ordersPagination').innerHTML = '';
    return;
  }

  tableContainer.innerHTML = `
    <div class="table-wrapper"><table class="data-table">
      <thead><tr>
        <th>Nº</th><th>Data/Hora</th><th>Tipo</th><th>Item</th><th>Qtd</th>
        <th>Total</th><th>Pagamento</th><th>Modo</th><th>Motoboy</th><th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>${pageOrders.map((o) => {
        const motoboy = config.motoboys.find((m) => m.id === o.motoboyId);
        return `<tr>
          <td><strong>#${o.orderNumber}</strong></td>
          <td>${formatDateTime(o.datetime)}</td>
          <td>${escapeHtml(o.type === 'pizza' ? 'Pizza' : 'Bebida')}</td>
          <td>${escapeHtml(o.itemName || buildOrderItemName({ type: 'pizza', size: o.size, flavors: o.flavors || [] }))} ${sizeLabel(o.size)}</td>
          <td>${o.quantity}x</td>
          <td>${formatMoney(o.total)}</td>
          <td>${paymentLabel(o.paymentMethod)}</td>
          <td>${(o.deliveryMode || 'delivery') === 'pickup' ? 'Retirada' : 'Entrega'}</td>
          <td>${motoboy ? escapeHtml(motoboy.name) : '—'}</td>
          <td>${statusTag(o.status)}</td>
          <td>
            <div class="table-actions table-actions--stack">
              <button type="button" class="btn btn--edit btn--sm" data-edit-order="${o.id}">✎ Editar</button>
              <button type="button" class="btn btn--secondary btn--sm" data-set-status="${o.id}|pendente">Pendente</button>
              <button type="button" class="btn btn--success btn--sm" data-set-status="${o.id}|entregue">Entregue</button>
              <button type="button" class="btn btn--danger btn--sm" data-set-status="${o.id}|cancelado">Cancelado</button>
              <button type="button" class="btn btn--danger btn--sm" data-delete-order="${o.id}">🗑 Excluir</button>
            </div>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;

  const pagContainer = container.querySelector('#ordersPagination');
  pagContainer.innerHTML = '';
  const pag = renderPagination({ page: listState.page, totalPages, onPageChange: (p) => {
    listState.page = p;
    renderOrdersTable(container, allOrders, config, ctx);
  }});
  if (pag.children.length) pagContainer.appendChild(pag);
}

function bindOrderEvents(container, ctx) {
  const { year, month } = ctx;
  const config = getConfig();
  container._ordersContext = { year, month };

  bindOrderFormSubmit(container, { year, month }, null);

  container.querySelector('#resetOrderFormBtn')?.addEventListener('click', () => {
    const form = container.querySelector('#orderForm');
    if (!form) return;
    const pizzaBtn = form.querySelector('.item-type-btn[data-type="pizza"]');
    if (pizzaBtn) pizzaBtn.click();
    form.querySelector('#orderNumber').value = peekNextOrderNumber(year, month);
    form.querySelector('#orderDatetime').value = nowDatetimeLocal();
    form.querySelector('#customerName').value = '';
    form.querySelector('#customerPhone').value = '';
    form.querySelector('#pizzaSize').value = '';
    form.querySelector('#drinkSelect').value = '';
    form.querySelector('#drinkSize').value = '';
    form.querySelector('#quantity').value = '1';
    form.querySelector('#orderMode').value = 'delivery';
    form.querySelector('#channel').value = '';
    form.querySelector('#payment').value = '';
    form.querySelector('#neighborhood').value = '';
    form.querySelector('#motoboy').value = '';
    form.querySelector('#observations').value = '';
    form.querySelector('#drinkSize').disabled = true;
    form.querySelector('#orderMode').dispatchEvent(new Event('change', { bubbles: true }));
    form.querySelector('#drinkSelect').dispatchEvent(new Event('change', { bubbles: true }));
    form.querySelector('#quantity').dispatchEvent(new Event('input', { bubbles: true }));
    const state = form._orderFormState;
    if (state && typeof state.setPizzaFlavorEntries === 'function') {
      state.setPizzaFlavorEntries([]);
    }
    toast('Formulário limpo e pronto para um novo pedido.', 'info');
  });

  container.querySelector('#duplicateLastOrderBtn')?.addEventListener('click', () => {
    const form = container.querySelector('#orderForm');
    const orders = getOrders(year, month);
    const template = [...orders].sort((a, b) => new Date(b.datetime) - new Date(a.datetime))[0];
    if (!template) {
      toast('Ainda não há pedidos para repetir.', 'info');
      return;
    }
    applyOrderTemplate(form, template, peekNextOrderNumber(year, month));
    toast('Último pedido carregado como base.', 'info');
  });

  container.querySelector('#filterSearch').value = listState.search || '';
  container.querySelector('#filterType').value = listState.itemType || '';
  container.querySelector('#filterStatus').value = listState.status;
  container.querySelector('#filterMode').value = listState.deliveryMode;
  container.querySelector('#filterDateMode').value = listState.dateMode;
  const dateInput = container.querySelector('#filterDateValue');
  if (dateInput) {
    dateInput.value = listState.dateValue || '';
    dateInput.disabled = listState.dateMode === 'none';
  }

  ['filterSearch', 'filterType', 'filterStatus', 'filterMode', 'filterDateMode', 'filterDateValue'].forEach((id) => {
    const el = container.querySelector(`#${id}`);
    if (!el) return;
    el.addEventListener('change', (e) => {
      const map = {
        filterSearch: 'search',
        filterType: 'itemType',
        filterStatus: 'status',
        filterMode: 'deliveryMode',
        filterDateMode: 'dateMode',
        filterDateValue: 'dateValue',
      };
      listState[map[id]] = e.target.value;
      if (id === 'filterDateMode') {
        const dateField = container.querySelector('#filterDateValue');
        if (dateField) {
          if (e.target.value === 'none') {
            dateField.value = '';
            listState.dateValue = '';
            dateField.disabled = true;
          } else {
            dateField.disabled = false;
          }
        }
      }
      listState.page = 1;
      renderOrdersTable(container, getOrders(year, month), config, ctx);
    });
  });

  container.querySelector('#filterSearch').addEventListener('input', (e) => {
    listState.search = e.target.value;
    listState.page = 1;
    renderOrdersTable(container, getOrders(year, month), config, ctx);
  });

  container.querySelector('#exportOrdersCsv')?.addEventListener('click', () => {
    exportFilteredOrders(filterOrders(getOrders(year, month)));
  });
  container.querySelector('#exportOrdersJson')?.addEventListener('click', () => {
    exportFilteredOrdersJSON(filterOrders(getOrders(year, month)));
  });

  if (!container._ordersEventsBound) {
    container._ordersEventsBound = true;
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const currentCtx = container._ordersContext || ctx;
      let orders = getOrders(currentCtx.year, currentCtx.month);
      let changed = false;

      if (btn.dataset.editOrder) {
        const order = orders.find((o) => o.id === btn.dataset.editOrder);
        if (order) openOrderEditModal(order, currentCtx, container);
        return;
      }

      if (btn.dataset.deliver) {
        const order = orders.find((o) => o.id === btn.dataset.deliver);
        if (order) { order.status = 'entregue'; changed = true; toast('Pedido marcado como entregue!', 'success'); }
      }

      if (btn.dataset.setStatus) {
        const [orderId, status] = btn.dataset.setStatus.split('|');
        const order = orders.find((o) => o.id === orderId);
        if (order && ['pendente', 'em_preparo', 'entregue', 'cancelado'].includes(status)) {
          order.status = status;
          changed = true;
          toast(`Pedido #${order.orderNumber} marcado como ${statusLabel(status)}.`, 'success');
        }
      }

      if (btn.dataset.deleteOrder) {
        const order = orders.find((o) => o.id === btn.dataset.deleteOrder);
        if (order && await confirmModal({
          title: 'Excluir Pedido',
          message: `Excluir o pedido #${order.orderNumber}? Esta ação não pode ser desfeita.`,
          confirmText: 'Excluir Pedido', danger: true,
        })) {
          orders = orders.filter((o) => o.id !== order.id);
          changed = true;
          toast('Pedido excluído.', 'info');
        }
      }

      if (changed) {
        saveOrders(currentCtx.year, currentCtx.month, orders);
        emitOrdersUpdated(currentCtx.year, currentCtx.month);
        renderOrdersPage(container, { year: currentCtx.year, month: currentCtx.month });
        return;
      }

      if (btn.id === 'showAllOrdersBtn') {
        listState = {
          page: 1,
          search: '',
          itemType: '',
          status: '',
          motoboy: '',
          payment: '',
          deliveryMode: '',
          dateMode: 'none',
          dateValue: '',
        };
        renderOrdersPage(container, { year: currentCtx.year, month: currentCtx.month });
        return;
      }
    });
  }

  function initKanbanDragAndDrop() {
    container.querySelectorAll('.kanban-card').forEach((card) => {
      card.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', card.dataset.orderId);
        event.dataTransfer.effectAllowed = 'move';
      });
    });

    container.querySelectorAll('.kanban-column').forEach((column) => {
      column.addEventListener('dragover', (event) => {
        event.preventDefault();
        column.classList.add('kanban-column--over');
      });
      column.addEventListener('dragleave', () => {
        column.classList.remove('kanban-column--over');
      });
      column.addEventListener('drop', (event) => {
        event.preventDefault();
        column.classList.remove('kanban-column--over');
        const orderId = event.dataTransfer.getData('text/plain');
        const status = column.dataset.status;
        if (!orderId || !status) return;
        const orders = getOrders(year, month);
        const order = orders.find((o) => o.id === orderId);
        if (!order || order.status === status) return;
        order.status = status;
        saveOrders(year, month, orders);
        emitOrdersUpdated(year, month);
        toast(`Pedido #${order.orderNumber} movido para ${statusLabel(status)}.`, 'success');
        renderOrdersPage(container, { year, month });
      });
    });
  }

  initKanbanDragAndDrop();
}
