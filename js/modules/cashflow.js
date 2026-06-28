/**
 * PROVOLETA — Módulo Fluxo de Caixa Mensal
 * Receita automática + CRUD de despesas.
 */

import { getCashflow, saveCashflow, calcMonthRevenue } from '../storage.js';
import { uid, formatMoney, formatDate, escapeHtml, parseMoney, todayDateInput } from '../utils.js';
import { toast, confirmModal, emptyState, tableActions, openFormModal } from '../ui.js';

const EXPENSE_CATEGORIES = [
  'Compra de Insumos', 'Diária de Motoboy', 'Energia', 'Aluguel', 'Embalagens', 'Marketing', 'Outros',
];

export function renderCashflowPage(container, { year, month }) {
  const revenue = calcMonthRevenue(year, month);
  const cashflow = getCashflow(year, month);
  const expenses = cashflow.expenses || [];
  const totalExpenses = expenses.reduce((s, e) => s + (e.value || 0), 0);
  const balance = revenue - totalExpenses;

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Fluxo de Caixa</h1>
      <p class="page-header__subtitle">Controle financeiro mensal</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card stat-card--green">
        <div class="stat-card__label">Total de Entradas</div>
        <div class="stat-card__value stat-card__value--positive">${formatMoney(revenue)}</div>
      </div>
      <div class="stat-card stat-card--red">
        <div class="stat-card__label">Total de Saídas</div>
        <div class="stat-card__value stat-card__value--negative">${formatMoney(totalExpenses)}</div>
      </div>
      <div class="stat-card stat-card--${balance >= 0 ? 'green' : 'red'}">
        <div class="stat-card__label">Saldo Líquido</div>
        <div class="stat-card__value ${balance >= 0 ? 'stat-card__value--positive' : 'stat-card__value--negative'}">${formatMoney(balance)}</div>
      </div>
    </div>

    <div class="caixa-auto-entry">
      <div class="caixa-auto-entry__info">
        <span class="caixa-auto-entry__label">Receita Consolidada de Vendas</span>
        <span class="caixa-auto-entry__value">${formatMoney(revenue)}</span>
        <span class="caixa-auto-entry__badge">Importado automaticamente dos pedidos · Não editável</span>
      </div>
      <span class="tag tag--ok">Automático</span>
    </div>

    <div class="card" style="margin-bottom:1.5rem">
      <div class="card__header"><h3 class="card__title">Lançar Despesa / Custo</h3></div>
      <form id="expenseForm">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Data</label>
            <input class="form-input" name="date" type="date" value="${todayDateInput()}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Categoria do Gasto</label>
            <select class="form-select" name="category" required>
              <option value="">Selecione...</option>
              ${EXPENSE_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Valor (R$)</label>
            <input class="form-input" name="value" type="number" step="0.01" min="0.01" required>
          </div>
          <div class="form-group form-group--full">
            <label class="form-label">Descrição Detalhada</label>
            <input class="form-input" name="description" required placeholder="Ex: Compra de 10kg de mussarela">
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn--primary">+ Lançar Despesa</button>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="card__header"><h3 class="card__title">Despesas do Mês</h3></div>
      <div id="expensesTable">
        ${expenses.length ? renderExpensesTable(expenses) : emptyState('💸', 'Nenhuma despesa lançada neste mês')}
      </div>
    </div>
  `;

  container.querySelector('#expenseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const cf = getCashflow(year, month);
    cf.expenses = cf.expenses || [];
    cf.expenses.push({
      id: uid(), date: fd.get('date'), category: fd.get('category'),
      description: fd.get('description').trim(), value: parseMoney(fd.get('value')),
    });
    saveCashflow(year, month, cf);
    toast('Despesa lançada!', 'success');
    renderCashflowPage(container, { year, month });
  });

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const cf = getCashflow(year, month);

    if (btn.dataset.editExpense) {
      const item = (cf.expenses || []).find((ex) => ex.id === btn.dataset.editExpense);
      if (!item) return;
      openFormModal({
        title: 'Editar Despesa',
        formHtml: `
          <div class="form-grid">
            <div class="form-group"><label class="form-label">Data</label>
              <input class="form-input" name="date" type="date" value="${item.date}" required></div>
            <div class="form-group"><label class="form-label">Categoria</label>
              <select class="form-select" name="category" required>
                ${EXPENSE_CATEGORIES.map((c) => `<option value="${c}" ${c === item.category ? 'selected' : ''}>${c}</option>`).join('')}
              </select></div>
            <div class="form-group"><label class="form-label">Valor (R$)</label>
              <input class="form-input" name="value" type="number" step="0.01" value="${item.value}" required></div>
            <div class="form-group form-group--full"><label class="form-label">Descrição</label>
              <input class="form-input" name="description" value="${escapeHtml(item.description)}" required></div>
          </div>`,
        onSubmit: (_, fd) => {
          item.date = fd.get('date');
          item.category = fd.get('category');
          item.description = fd.get('description').trim();
          item.value = parseMoney(fd.get('value'));
          saveCashflow(year, month, cf);
          toast('Despesa atualizada!', 'success');
          renderCashflowPage(container, { year, month });
        },
      });
      return;
    }

    if (btn.dataset.deleteExpense) {
      if (!await confirmModal({ title: 'Excluir Despesa', message: 'Confirma a exclusão?', danger: true })) return;
      cf.expenses = (cf.expenses || []).filter((ex) => ex.id !== btn.dataset.deleteExpense);
      saveCashflow(year, month, cf);
      toast('Despesa excluída.', 'info');
      renderCashflowPage(container, { year, month });
    }
  });
}

function renderExpensesTable(expenses) {
  const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  return `
    <div class="table-wrapper"><table class="data-table">
      <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Ações</th></tr></thead>
      <tbody>${sorted.map((e) => `
        <tr>
          <td>${formatDate(e.date)}</td>
          <td>${escapeHtml(e.category)}</td>
          <td>${escapeHtml(e.description)}</td>
          <td>${formatMoney(e.value)}</td>
          <td>${tableActions(`data-edit-expense="${e.id}"`, `data-delete-expense="${e.id}"`)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
}
