/**
 * PROVOLETA — Módulo de Lançamento de Pedidos
 * CRUD completo com formulário blindado e edição via modal.
 */

import {
  getConfig, getOrders, saveOrders, peekNextOrderNumber,
  syncOrderCounter, calcMonthRevenue,
} from '../storage.js';
import {
  uid, formatMoney, nowDatetimeLocal, datetimeLocalToISO, isoToDatetimeLocal,
  formatDateTime, escapeHtml, paymentLabel, sizeLabel, parseMoney,
} from '../utils.js';
import { toast, confirmModal, renderPagination, statusTag, emptyState, tableActions, openFormModal } from '../ui.js';

const PAGE_SIZE = 10;
const QUICK_ORDER_STORAGE_KEY = 'provoleta_quick_order_defaults';
let listState = { page: 1, status: '', motoboy: '', payment: '', deliveryMode: '' };

function readQuickOrderDefaults() {
  try {
    return JSON.parse(localStorage.getItem(QUICK_ORDER_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveQuickOrderDefaults(formEl) {
  const payload = {
    itemType: formEl.querySelector('.item-type-btn.active')?.dataset.type || 'pizza',
    flavorId: formEl.querySelector('#flavorSelect')?.value || '',
    pizzaSize: formEl.querySelector('#pizzaSize')?.value || '',
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
  buttons.forEach((btn) => btn.classList.toggle('active', btn.dataset.type === itemType));
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
    const flavorSelect = formEl.querySelector('#flavorSelect');
    if (flavorSelect) {
      flavorSelect.value = defaults.flavorId || '';
      flavorSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const pizzaSize = formEl.querySelector('#pizzaSize');
    if (pizzaSize) {
      pizzaSize.value = defaults.pizzaSize || '';
      pizzaSize.dispatchEvent(new Event('change', { bubbles: true }));
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
    formEl.querySelector('#flavorSelect').value = template.itemId || '';
    formEl.querySelector('#pizzaSize').value = template.size || '';
    formEl.querySelector('#flavorSelect').dispatchEvent(new Event('change', { bubbles: true }));
    formEl.querySelector('#pizzaSize').dispatchEvent(new Event('change', { bubbles: true }));
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

      <div class="card">
        <div class="card__header"><h3 class="card__title">Pedidos do Mês</h3></div>
        <div class="filters-bar">
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="filterStatus">
              <option value="">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="entregue">Entregue</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Motoboy</label>
            <select class="form-select" id="filterMotoboy">
              <option value="">Todos</option>
              ${config.motoboys.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Pagamento</label>
            <select class="form-select" id="filterPayment">
              <option value="">Todos</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="cartao">Cartão</option>
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
  const itemType = order?.type || 'pizza';
  const dt = order ? isoToDatetimeLocal(order.datetime) : nowDatetimeLocal();

  return `
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Nº do Pedido</label>
        <input class="form-input" id="orderNumber" type="number" min="1" value="${order?.orderNumber ?? defaultOrderNum}">
      </div>
      <div class="form-group">
        <label class="form-label">Data e Hora</label>
        <input class="form-input" id="orderDatetime" type="datetime-local" value="${dt}">
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

    <div class="section-divider"></div>

    <label class="form-label">Tipo de Item</label>
    <div class="item-type-selector">
      <button type="button" class="item-type-btn ${itemType === 'pizza' ? 'active' : ''}" data-type="pizza">Pizza</button>
      <button type="button" class="item-type-btn ${itemType === 'bebida' ? 'active' : ''}" data-type="bebida">Bebida</button>
    </div>

    <div id="pizzaFields" style="display:${itemType === 'pizza' ? 'block' : 'none'}">
      <div class="form-group" style="margin-bottom:0.75rem">
        <label class="form-label">Sabor</label>
        <select class="form-select" id="flavorSelect">
          <option value="">Selecione o sabor...</option>
          ${config.flavors.map((f) => {
            const cat = config.categories.find((c) => c.id === f.categoryId);
            return `<option value="${f.id}" ${order?.itemId === f.id && itemType === 'pizza' ? 'selected' : ''}>${escapeHtml(f.name)}${cat ? ` (${escapeHtml(cat.name)})` : ''}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:0.75rem">
        <label class="form-label">Tamanho</label>
        <select class="form-select" id="pizzaSize" ${!order?.itemId || itemType !== 'pizza' ? 'disabled' : ''}>
          <option value="">Selecione...</option>
          ${['P', 'M', 'G'].map((s) => `<option value="${s}" ${order?.size === s && itemType === 'pizza' ? 'selected' : ''}>${sizeLabel(s)}</option>`).join('')}
        </select>
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
        <input class="form-input" id="quantity" type="number" min="1" value="${order?.quantity ?? 1}">
      </div>
      <div class="form-group">
        <label class="form-label">Valor Unitário</label>
        <input class="form-input form-input--locked" id="unitPrice" readonly value="${formatMoney(order?.unitPrice ?? 0)}">
      </div>
    </div>

    <div class="section-divider"></div>

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
  let currentUnitPrice = order?.unitPrice || 0;
  let currentDeliveryFee = order?.deliveryFee || 0;

  const els = {
    flavorSelect: formEl.querySelector('#flavorSelect'),
    pizzaSize: formEl.querySelector('#pizzaSize'),
    orderMode: formEl.querySelector('#orderMode'),
    drinkSelect: formEl.querySelector('#drinkSelect'),
    drinkSize: formEl.querySelector('#drinkSize'),
    quantity: formEl.querySelector('#quantity'),
    unitPrice: formEl.querySelector('#unitPrice'),
    neighborhood: formEl.querySelector('#neighborhood'),
    neighborhoodGroup: formEl.querySelector('#neighborhoodGroup'),
    deliveryFee: formEl.querySelector('#deliveryFee'),
    deliveryFeeGroup: formEl.querySelector('#deliveryFeeGroup'),
    motoboy: formEl.querySelector('#motoboy'),
    motoboyGroup: formEl.querySelector('#motoboyGroup'),
    orderTotal: formEl.querySelector('#orderTotal'),
    pizzaFields: formEl.querySelector('#pizzaFields'),
    drinkFields: formEl.querySelector('#drinkFields'),
  };

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
    const qty = parseInt(els.quantity.value, 10) || 1;
    const total = (qty * currentUnitPrice) + currentDeliveryFee;
    els.orderTotal.textContent = formatMoney(total);
    return total;
  }

  function updateUnitPrice() {
    currentUnitPrice = 0;
    if (itemType === 'pizza') {
      const flavor = config.flavors.find((f) => f.id === els.flavorSelect.value);
      const cat = config.categories.find((c) => c.id === flavor?.categoryId);
      if (cat && els.pizzaSize.value) {
        currentUnitPrice = els.pizzaSize.value === 'P' ? cat.priceP : els.pizzaSize.value === 'M' ? cat.priceM : cat.priceG;
      }
    } else {
      const drink = config.drinks.find((d) => d.id === els.drinkSelect.value);
      if (drink && els.drinkSize.value) {
        currentUnitPrice = els.drinkSize.value === 'Lata' ? drink.priceLata : drink.price1L;
      }
    }
    els.unitPrice.value = formatMoney(currentUnitPrice);
    calcTotal();
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

  els.flavorSelect?.addEventListener('change', () => {
    els.pizzaSize.disabled = !els.flavorSelect.value;
    if (!els.flavorSelect.value) els.pizzaSize.value = '';
    updateUnitPrice();
  });
  els.pizzaSize?.addEventListener('change', updateUnitPrice);
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
  els.quantity?.addEventListener('input', calcTotal);

  const dtInput = formEl.querySelector('#orderDatetime');
  if (dtInput && !order) {
    dtInput.addEventListener('focus', function () { if (!this.dataset.edited) this.value = nowDatetimeLocal(); });
    dtInput.addEventListener('change', function () { this.dataset.edited = '1'; });
  }

  updateDeliveryModeUI();
  formEl._orderFormState = { getItemType: () => itemType, calcTotal, getPrices: () => ({ currentUnitPrice, currentDeliveryFee }) };
  if (!order) applyQuickOrderDefaults(formEl);
  if (onReady) onReady();
}

function collectOrderData(formEl, config) {
  const state = formEl._orderFormState;
  const itemType = state.getItemType();
  const { currentUnitPrice, currentDeliveryFee } = state.getPrices();

  if (itemType === 'pizza' && (!formEl.querySelector('#flavorSelect').value || !formEl.querySelector('#pizzaSize').value)) {
    toast('Selecione o sabor e tamanho da pizza.', 'error'); return null;
  }
  if (itemType === 'bebida' && (!formEl.querySelector('#drinkSelect').value || !formEl.querySelector('#drinkSize').value)) {
    toast('Selecione a bebida e o tamanho.', 'error'); return null;
  }
  const deliveryMode = formEl.querySelector('#orderMode').value;
  if (deliveryMode === 'delivery' && (!formEl.querySelector('#neighborhood').value || !formEl.querySelector('#motoboy').value)) {
    toast('Para entregas, selecione bairro e motoboy.', 'error'); return null;
  }
  if (!formEl.querySelector('#channel').value || !formEl.querySelector('#payment').value) {
    toast('Preencha todos os campos obrigatórios.', 'error'); return null;
  }

  let itemId, itemName, size, categoryId;
  if (itemType === 'pizza') {
    const flavor = config.flavors.find((f) => f.id === formEl.querySelector('#flavorSelect').value);
    itemId = flavor.id; itemName = flavor.name; size = formEl.querySelector('#pizzaSize').value; categoryId = flavor.categoryId;
  } else {
    const drink = config.drinks.find((d) => d.id === formEl.querySelector('#drinkSelect').value);
    itemId = drink.id; itemName = drink.name; size = formEl.querySelector('#drinkSize').value; categoryId = null;
  }

  return {
    orderNumber: parseInt(formEl.querySelector('#orderNumber').value, 10),
    datetime: datetimeLocalToISO(formEl.querySelector('#orderDatetime').value),
    type: itemType, itemId, itemName, size, categoryId,
    quantity: parseInt(formEl.querySelector('#quantity').value, 10) || 1,
    unitPrice: currentUnitPrice,
    deliveryMode,
    neighborhoodId: deliveryMode === 'delivery' ? formEl.querySelector('#neighborhood').value : '',
    deliveryFee: deliveryMode === 'delivery' ? currentDeliveryFee : 0,
    channelId: formEl.querySelector('#channel').value,
    motoboyId: deliveryMode === 'delivery' ? formEl.querySelector('#motoboy').value : '',
    paymentMethod: formEl.querySelector('#payment').value,
    observations: formEl.querySelector('#observations').value.trim(),
    total: state.calcTotal(),
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
      toast(`Pedido #${data.orderNumber} atualizado!`, 'success');
      renderOrdersPage(container, ctx);
    },
  });

  const modalForm = document.querySelector('#editModalForm');
  if (modalForm) bindOrderForm(modalForm, config, order);
}

function renderOrdersTable(container, allOrders, config, ctx) {
  let filtered = [...allOrders];
  if (listState.status) filtered = filtered.filter((o) => o.status === listState.status);
  if (listState.motoboy) filtered = filtered.filter((o) => o.motoboyId === listState.motoboy);
  if (listState.payment) filtered = filtered.filter((o) => o.paymentMethod === listState.payment);
  if (listState.deliveryMode) filtered = filtered.filter((o) => (o.deliveryMode || 'delivery') === listState.deliveryMode);
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
        <th>Nº</th><th>Data/Hora</th><th>Item</th><th>Qtd</th>
        <th>Total</th><th>Pagamento</th><th>Modo</th><th>Motoboy</th><th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>${pageOrders.map((o) => {
        const motoboy = config.motoboys.find((m) => m.id === o.motoboyId);
        return `<tr>
          <td><strong>#${o.orderNumber}</strong></td>
          <td>${formatDateTime(o.datetime)}</td>
          <td>${escapeHtml(o.itemName)} ${sizeLabel(o.size)}</td>
          <td>${o.quantity}x</td>
          <td>${formatMoney(o.total)}</td>
          <td>${paymentLabel(o.paymentMethod)}</td>
          <td>${(o.deliveryMode || 'delivery') === 'pickup' ? 'Retirada' : 'Entrega'}</td>
          <td>${motoboy ? escapeHtml(motoboy.name) : '—'}</td>
          <td>${statusTag(o.status)}</td>
          <td>
            <div class="table-actions table-actions--stack">
              <button type="button" class="btn btn--edit btn--sm" data-edit-order="${o.id}">Editar</button>
              ${o.status === 'pendente' ? `<button type="button" class="btn btn--success btn--sm" data-deliver="${o.id}">Entregue</button>` : ''}
              <button type="button" class="btn btn--danger btn--sm" data-delete-order="${o.id}">Excluir</button>
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

  bindOrderFormSubmit(container, ctx, null);

  container.querySelector('#resetOrderFormBtn')?.addEventListener('click', () => {
    const form = container.querySelector('#orderForm');
    if (!form) return;
    const pizzaBtn = form.querySelector('.item-type-btn[data-type="pizza"]');
    if (pizzaBtn) pizzaBtn.click();
    form.querySelector('#orderNumber').value = peekNextOrderNumber(year, month);
    form.querySelector('#orderDatetime').value = nowDatetimeLocal();
    form.querySelector('#flavorSelect').value = '';
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
    form.querySelector('#pizzaSize').disabled = true;
    form.querySelector('#drinkSize').disabled = true;
    form.querySelector('#orderMode').dispatchEvent(new Event('change', { bubbles: true }));
    form.querySelector('#flavorSelect').dispatchEvent(new Event('change', { bubbles: true }));
    form.querySelector('#drinkSelect').dispatchEvent(new Event('change', { bubbles: true }));
    form.querySelector('#quantity').dispatchEvent(new Event('input', { bubbles: true }));
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

  container.querySelector('#filterStatus').value = listState.status;
  container.querySelector('#filterMotoboy').value = listState.motoboy;
  container.querySelector('#filterPayment').value = listState.payment;
  container.querySelector('#filterMode').value = listState.deliveryMode;

  ['filterStatus', 'filterMotoboy', 'filterPayment', 'filterMode'].forEach((id) => {
    container.querySelector(`#${id}`).addEventListener('change', (e) => {
      const map = { filterStatus: 'status', filterMotoboy: 'motoboy', filterPayment: 'payment', filterMode: 'deliveryMode' };
      listState[map[id]] = e.target.value;
      listState.page = 1;
      renderOrdersTable(container, getOrders(year, month), config, ctx);
    });
  });

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    let orders = getOrders(year, month);
    let changed = false;

    if (btn.dataset.editOrder) {
      const order = orders.find((o) => o.id === btn.dataset.editOrder);
      if (order) openOrderEditModal(order, ctx, container);
      return;
    }

    if (btn.dataset.deliver) {
      const order = orders.find((o) => o.id === btn.dataset.deliver);
      if (order) { order.status = 'entregue'; changed = true; toast('Pedido marcado como entregue!', 'success'); }
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
      saveOrders(year, month, orders);
      renderOrdersPage(container, ctx);
    }
  });
}
