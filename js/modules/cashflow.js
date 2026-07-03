/**
 * PROVOLETA — Módulo Fluxo de Caixa Mensal
 * Receita automática + CRUD de entradas e despesas.
 */

import { getCashflow, saveCashflow, calcMonthRevenue } from '../storage.js';
import { uid, formatMoney, formatDate, escapeHtml, parseMoney, todayDateInput } from '../utils.js';
import { toast, confirmModal, emptyState, tableActions, openFormModal } from '../ui.js';

const INCOME_CATEGORIES = [
  'Recebimento de Cliente', 'Transferência', 'Reembolso', 'Venda de Estoque', 'Outros',
];
const EXPENSE_CATEGORIES = [
  'Compra de Insumos', 'Diária de Motoboy', 'Energia', 'Aluguel', 'Embalagens', 'Marketing', 'Outros',
];

export function renderCashflowPage(container, { year, month }) {
  const revenue = calcMonthRevenue(year, month);
  const cashflow = getCashflow(year, month);
  const entries = (cashflow.entries || []).map((e) => ({ ...e, type: 'entrada' }));
  const expenses = (cashflow.expenses || []).map((e) => ({ ...e, type: 'despesa' }));
  const totalEntries = revenue + entries.reduce((s, e) => s + (e.value || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.value || 0), 0);
  const balance = totalEntries - totalExpenses;

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Fluxo de Caixa</h1>
      <p class="page-header__subtitle">Controle financeiro mensal com entradas e despesas</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card stat-card--green">
        <div class="stat-card__label">Total de Entradas</div>
        <div class="stat-card__value stat-card__value--positive">${formatMoney(totalEntries)}</div>
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
        <span class="caixa-auto-entry__label">Receita consolidada</span>
        <span class="caixa-auto-entry__value">${formatMoney(totalEntries)}</span>
        <span class="caixa-auto-entry__badge">Pedidos + entradas extras registradas</span>
      </div>
      <span class="tag tag--ok">Atualizado</span>
    </div>

    <div class="card" style="margin-bottom:1.25rem">
      <div class="card__header"><h3 class="card__title">Lançar Entrada</h3></div>
      <form id="incomeForm">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Data</label>
            <input class="form-input" name="date" type="date" value="${todayDateInput()}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Categoria da Entrada</label>
            <select class="form-select" name="category" required>
              <option value="">Selecione...</option>
              ${INCOME_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Valor (R$)</label>
            <input class="form-input" name="value" type="number" step="0.01" min="0.01" required>
          </div>
          <div class="form-group form-group--full">
            <label class="form-label">Descrição</label>
            <input class="form-input" name="description" required placeholder="Ex: Recebimento de conta, devolução, transferência">
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn--primary">+ Lançar Entrada</button>
        </div>
      </form>
    </div>

    <div class="card" style="margin-bottom:1.25rem">
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
      <div class="card__header"><h3 class="card__title">Lançamentos do Mês</h3></div>
      <div class="filters-bar">
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select class="form-select" id="movementFilterType">
            <option value="all">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="despesa">Despesas</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Categoria</label>
          <select class="form-select" id="movementFilterCategory">
            <option value="all">Todas</option>
            ${[...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map((c) => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Busca</label>
          <input class="form-input" id="movementFilterSearch" placeholder="Descrição ou categoria">
        </div>
      </div>
      <div id="movementsTableContainer"></div>
    </div>
  `;

  container.querySelector('#incomeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const cf = getCashflow(year, month);
    cf.entries = cf.entries || [];
    cf.entries.push({
      id: uid(), date: fd.get('date'), category: fd.get('category'),
      description: fd.get('description').trim(), value: parseMoney(fd.get('value')),
    });
    saveCashflow(year, month, cf);
    toast('Entrada lançada!', 'success');
    renderCashflowPage(container, { year, month });
  });

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

  bindMovementFilters(container, year, month);
  renderMovementTable(container, year, month);

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const cf = getCashflow(year, month);

    if (btn.dataset.editEntry) {
      const item = (cf.entries || []).find((entry) => entry.id === btn.dataset.editEntry);
      if (!item) return;
      openFormModal({
        title: 'Editar Entrada',
        formHtml: `
          <div class="form-grid">
            <div class="form-group"><label class="form-label">Data</label>
              <input class="form-input" name="date" type="date" value="${item.date}" required></div>
            <div class="form-group"><label class="form-label">Categoria</label>
              <select class="form-select" name="category" required>
                ${INCOME_CATEGORIES.map((c) => `<option value="${c}" ${c === item.category ? 'selected' : ''}>${c}</option>`).join('')}
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
          toast('Entrada atualizada!', 'success');
          renderCashflowPage(container, { year, month });
        },
      });
      return;
    }

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

    if (btn.dataset.deleteEntry) {
      if (!await confirmModal({ title: 'Excluir Entrada', message: 'Confirma a exclusão?', danger: true })) return;
      cf.entries = (cf.entries || []).filter((entry) => entry.id !== btn.dataset.deleteEntry);
      saveCashflow(year, month, cf);
      toast('Entrada excluída.', 'info');
      renderCashflowPage(container, { year, month });
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

function bindMovementFilters(container, year, month) {
  const typeFilter = container.querySelector('#movementFilterType');
  const categoryFilter = container.querySelector('#movementFilterCategory');
  const searchFilter = container.querySelector('#movementFilterSearch');

  [typeFilter, categoryFilter, searchFilter].forEach((el) => {
    el?.addEventListener('input', () => renderMovementTable(container, year, month));
    el?.addEventListener('change', () => renderMovementTable(container, year, month));
  });
}

function renderMovementTable(container, year, month) {
  const cashflow = getCashflow(year, month);
  const movements = [
    ...(cashflow.entries || []).map((entry) => ({ ...entry, type: 'entrada' })),
    ...(cashflow.expenses || []).map((expense) => ({ ...expense, type: 'despesa' })),
  ];
  const type = container.querySelector('#movementFilterType')?.value || 'all';
  const category = container.querySelector('#movementFilterCategory')?.value || 'all';
  const search = (container.querySelector('#movementFilterSearch')?.value || '').trim().toLowerCase();

  const filtered = movements.filter((item) => {
    const matchesType = type === 'all' || item.type === type;
    const matchesCategory = category === 'all' || item.category === category;
    const haystack = `${item.description || ''} ${item.category || ''}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    return matchesType && matchesCategory && matchesSearch;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const table = container.querySelector('#movementsTableContainer');
  if (!table) return;
  table.innerHTML = filtered.length ? renderMovementsTable(filtered) : emptyState('📋', 'Nenhum lançamento encontrado com estes filtros');
}

function renderMovementsTable(movements) {
  return `
    <div class="table-wrapper"><table class="data-table">
      <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Ações</th></tr></thead>
      <tbody>${movements.map((entry) => `
        <tr>
          <td>${formatDate(entry.date)}</td>
          <td>${entry.type === 'entrada' ? '<span class="tag tag--ok">Entrada</span>' : '<span class="tag tag--pending">Despesa</span>'}</td>
          <td>${escapeHtml(entry.category)}</td>
          <td>${escapeHtml(entry.description)}</td>
          <td>${formatMoney(entry.value)}</td>
          <td>${tableActions(
            entry.type === 'entrada' ? `data-edit-entry="${entry.id}"` : `data-edit-expense="${entry.id}"`,
            entry.type === 'entrada' ? `data-delete-entry="${entry.id}"` : `data-delete-expense="${entry.id}"`
          )}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
}
