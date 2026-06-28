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
let listState = { page: 1, status: '', motoboy: '', payment: '' };

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
        <div class="card__header"><h3 class="card__title">Novo Pedido</h3></div>
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
        <label class="form-label">Bairro</label>
        <select class="form-select" id="neighborhood" required>
          <option value="">Selecione...</option>
          ${config.neighborhoods.map((n) => `<option value="${n.id}" data-fee="${n.fee}" ${order?.neighborhoodId === n.id ? 'selected' : ''}>${escapeHtml(n.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Taxa de Entrega</label>
        <input class="form-input form-input--locked" id="deliveryFee" readonly value="${formatMoney(order?.deliveryFee ?? 0)}">
      </div>
      <div class="form-group">
        <label class="form-label">Canal de Venda</label>
        <select class="form-select" id="channel" required>
          <option value="">Selecione...</option>
          ${config.channels.map((c) => `<option value="${c.id}" ${order?.channelId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Motoboy</label>
        <select class="form-select" id="motoboy" required>
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
    drinkSelect: formEl.querySelector('#drinkSelect'),
    drinkSize: formEl.querySelector('#drinkSize'),
    quantity: formEl.querySelector('#quantity'),
    unitPrice: formEl.querySelector('#unitPrice'),
    neighborhood: formEl.querySelector('#neighborhood'),
    deliveryFee: formEl.querySelector('#deliveryFee'),
    orderTotal: formEl.querySelector('#orderTotal'),
    pizzaFields: formEl.querySelector('#pizzaFields'),
    drinkFields: formEl.querySelector('#drinkFields'),
  };

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

  formEl._orderFormState = { getItemType: () => itemType, calcTotal, getPrices: () => ({ currentUnitPrice, currentDeliveryFee }) };
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
  if (!formEl.querySelector('#neighborhood').value || !formEl.querySelector('#channel').value ||
      !formEl.querySelector('#motoboy').value || !formEl.querySelector('#payment').value) {
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
    neighborhoodId: formEl.querySelector('#neighborhood').value,
    deliveryFee: currentDeliveryFee,
    channelId: formEl.querySelector('#channel').value,
    motoboyId: formEl.querySelector('#motoboy').value,
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
        <th>Total</th><th>Pagamento</th><th>Motoboy</th><th>Status</th><th>Ações</th>
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

  container.querySelector('#filterStatus').value = listState.status;
  container.querySelector('#filterMotoboy').value = listState.motoboy;
  container.querySelector('#filterPayment').value = listState.payment;

  ['filterStatus', 'filterMotoboy', 'filterPayment'].forEach((id) => {
    container.querySelector(`#${id}`).addEventListener('change', (e) => {
      const map = { filterStatus: 'status', filterMotoboy: 'motoboy', filterPayment: 'payment' };
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
