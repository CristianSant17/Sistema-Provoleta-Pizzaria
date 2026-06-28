/**
 * PROVOLETA — Acerto de Contas com Motoboys
 * Relatório de entregas + calculadora de fechamento em dinheiro.
 */

import { getConfig, getOrders } from '../storage.js';
import {
  formatMoney, formatDateTime, escapeHtml, paymentLabel,
  isSameDay, todayDateInput,
} from '../utils.js';
import { emptyState } from '../ui.js';

export function renderMotoboysPage(container, { year, month }) {
  const config = getConfig();
  const activeMotoboys = config.motoboys.filter((m) => m.active);

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Acerto de Contas — Motoboys</h1>
      <p class="page-header__subtitle">Fechamento diário com entregadores</p>
    </div>

    <div class="motoboy-layout">
      <div class="card">
        <div class="card__header"><h3 class="card__title">Seleção</h3></div>
        <div class="form-group" style="margin-bottom:1rem">
          <label class="form-label">Motoboy</label>
          <select class="form-select" id="motoboySelect">
            <option value="">Selecione o motoboy...</option>
            ${activeMotoboys.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Filtrar por Dia (opcional)</label>
          <input class="form-input" id="filterDate" type="date" value="${todayDateInput()}">
          <span class="form-hint">Deixe em branco para ver todo o mês</span>
        </div>
        <div class="form-group" style="margin-top:1rem">
          <label class="form-label">
            <input type="checkbox" id="filterDayOnly" checked> Filtrar apenas o dia selecionado
          </label>
        </div>
      </div>

      <div id="motoboyReport">
        ${emptyState('🏍️', 'Selecione um motoboy', 'O relatório de entregas será exibido aqui.')}
      </div>
    </div>
  `;

  if (!activeMotoboys.length) {
    container.querySelector('#motoboyReport').innerHTML = emptyState('🏍️', 'Nenhum motoboy cadastrado', 'Cadastre motoboys em Configurações.');
    return;
  }

  const renderReport = () => {
    const motoboyId = container.querySelector('#motoboySelect').value;
    if (!motoboyId) {
      container.querySelector('#motoboyReport').innerHTML = emptyState('🏍️', 'Selecione um motoboy');
      return;
    }

    const motoboy = config.motoboys.find((m) => m.id === motoboyId);
    let orders = getOrders(year, month)
      .filter((o) => o.motoboyId === motoboyId && o.status !== 'cancelado');

    const filterDayOnly = container.querySelector('#filterDayOnly').checked;
    const filterDate = container.querySelector('#filterDate').value;

    if (filterDayOnly && filterDate) {
      orders = orders.filter((o) => isSameDay(o.datetime, filterDate + 'T12:00:00'));
    }

    const deliveredOrders = orders.filter((o) => o.status === 'entregue');
    const totalDeliveries = deliveredOrders.length;
    const totalFees = deliveredOrders.reduce((s, o) => s + (o.deliveryFee || 0), 0);
    const cashOrders = deliveredOrders.filter((o) => o.paymentMethod === 'dinheiro');
    const totalCashExpected = cashOrders.reduce((s, o) => s + (o.total || 0), 0);

    container.querySelector('#motoboyReport').innerHTML = `
      <div class="card">
        <div class="card__header">
          <h3 class="card__title">${escapeHtml(motoboy.name)} — Relatório</h3>
        </div>

        <div class="motoboy-summary-grid">
          <div class="motoboy-summary-item">
            <div class="motoboy-summary-item__value">${totalDeliveries}</div>
            <div class="motoboy-summary-item__label">Corridas Entregues</div>
          </div>
          <div class="motoboy-summary-item">
            <div class="motoboy-summary-item__value">${formatMoney(totalFees)}</div>
            <div class="motoboy-summary-item__label">Taxas de Entrega</div>
          </div>
          <div class="motoboy-summary-item">
            <div class="motoboy-summary-item__value">${formatMoney(totalCashExpected)}</div>
            <div class="motoboy-summary-item__label">Dinheiro dos Pedidos</div>
          </div>
        </div>

        ${orders.length ? `
          <div class="table-wrapper" style="margin-bottom:1.5rem">
            <table class="data-table">
              <thead><tr>
                <th>Nº</th><th>Data/Hora</th><th>Item</th><th>Total</th>
                <th>Taxa</th><th>Pagamento</th><th>Status</th>
              </tr></thead>
              <tbody>${orders.map((o) => `
                <tr>
                  <td>#${o.orderNumber}</td>
                  <td>${formatDateTime(o.datetime)}</td>
                  <td>${escapeHtml(o.itemName)}</td>
                  <td>${formatMoney(o.total)}</td>
                  <td>${formatMoney(o.deliveryFee)}</td>
                  <td>${paymentLabel(o.paymentMethod)}</td>
                  <td>${o.status === 'entregue' ? '<span class="tag tag--ok">Entregue</span>' : '<span class="tag tag--pending">Pendente</span>'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>` : emptyState('📋', 'Nenhum pedido encontrado')}

        <div class="motoboy-calc-card">
          <h4>💵 Calculadora de Fechamento</h4>
          <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:1rem">
            Informe quanto em dinheiro físico o motoboy trouxe das ruas. O sistema cruza com os pedidos em dinheiro.
          </p>
          <div class="form-group">
            <label class="form-label">Dinheiro Físico Recebido (R$)</label>
            <input class="form-input" id="cashReceived" type="number" step="0.01" min="0" placeholder="0,00">
          </div>
          <div id="settlementResult"></div>
        </div>
      </div>
    `;

    const cashInput = container.querySelector('#cashReceived');
    const resultEl = container.querySelector('#settlementResult');

    const calcSettlement = () => {
      const received = parseFloat(cashInput.value) || 0;
      const diff = received - totalCashExpected;

      if (!cashInput.value) {
        resultEl.innerHTML = '';
        return;
      }

      let cls, title, detail;
      if (Math.abs(diff) < 0.01) {
        cls = 'ok'; title = '✓ Caixa Bateu!'; detail = 'O valor recebido confere com os pedidos em dinheiro.';
      } else if (diff > 0) {
        cls = 'over'; title = '↑ Sobra de ' + formatMoney(diff); detail = 'O motoboy trouxe mais do que o esperado em pedidos em dinheiro.';
      } else {
        cls = 'short'; title = '↓ Faltando ' + formatMoney(Math.abs(diff)); detail = 'O motoboy trouxe menos do que o esperado. Verifique os pedidos.';
      }

      resultEl.innerHTML = `
        <div class="settlement-result settlement-result--${cls}">
          <div class="settlement-result__title">${title}</div>
          <p>${detail}</p>
          <p style="margin-top:0.5rem;font-size:0.85rem">
            Esperado: ${formatMoney(totalCashExpected)} · Recebido: ${formatMoney(received)}
          </p>
        </div>`;
    };

    cashInput.addEventListener('input', calcSettlement);
  };

  container.querySelector('#motoboySelect').addEventListener('change', renderReport);
  container.querySelector('#filterDate').addEventListener('change', renderReport);
  container.querySelector('#filterDayOnly').addEventListener('change', renderReport);
}
