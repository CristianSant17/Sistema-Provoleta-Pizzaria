/**
 * PROVOLETA — Central de Dashboards
 * Visão mensal e histórico total com gráficos Chart.js.
 */

import {
  getAllOrders, getAllExpenses, getAllCashflowEntries,
  getConfig,
} from '../storage.js';
import { formatMoney, escapeHtml, monthLabel } from '../utils.js';
import { emptyState } from '../ui.js';

function buildPeriodSummary(data) {
  const items = [];
  if (data.revenue > 0) items.push({ label: 'Vendas', value: data.revenue, tone: 'positive' });
  if (data.extraEntries > 0) items.push({ label: 'Entradas extras', value: data.extraEntries, tone: 'positive' });
  if (data.expenses > 0) items.push({ label: 'Despesas', value: data.expenses, tone: 'negative' });
  if (data.profit !== 0) items.push({ label: 'Lucro', value: data.profit, tone: data.profit >= 0 ? 'positive' : 'negative' });
  return items;
}

function exportDashboardCsv(data) {
  const rows = [
    ['Tipo', 'Categoria', 'Descrição', 'Valor', 'Data'],
    ...[...data.entries, ...data.expensesData].map((entry) => [
      entry.type || (data.entries.includes(entry) ? 'entrada' : 'despesa'),
      entry.category || '',
      entry.description || '',
      entry.value || 0,
      entry.date || '',
    ]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'relatorio_provoleta.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportDashboardPdf(data) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;
  const rows = [...data.entries, ...data.expensesData].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const html = `
    <html>
      <head><title>Relatório Provoleta</title><style>body{font-family:Arial;padding:24px;color:#111}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style></head>
      <body>
        <h2>Relatório Provoleta</h2>
        <p><strong>Período:</strong> ${escapeHtml(data.label)}</p>
        <p><strong>Receita:</strong> ${formatMoney(data.income)}</p>
        <p><strong>Despesas:</strong> ${formatMoney(data.expenses)}</p>
        <p><strong>Lucro:</strong> ${formatMoney(data.profit)}</p>
        <table>
          <thead><tr><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Data</th></tr></thead>
          <tbody>${rows.map((entry) => `<tr><td>${entry.type || (data.entries.includes(entry) ? 'entrada' : 'despesa')}</td><td>${escapeHtml(entry.category || '')}</td><td>${escapeHtml(entry.description || '')}</td><td>${formatMoney(entry.value || 0)}</td><td>${escapeHtml(entry.date || '')}</td></tr>`).join('')}</tbody>
        </table>
      </body>
    </html>`;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

let chartInstances = [];

function getPeriodBounds(period, year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  if (period === 'week') {
    const weekEnd = new Date(end);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    return { start: weekStart, end: weekEnd };
  }
  if (period === 'year') {
    return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59, 999) };
  }
  return { start, end };
}

function getPreviousPeriodBounds(period, year, month) {
  if (period === 'month') {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return getPeriodBounds('month', prevYear, prevMonth);
  }
  if (period === 'year') {
    return getPeriodBounds('year', year - 1, month);
  }
  const prevEnd = new Date(year, month - 1, 1);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 6);
  return { start: prevStart, end: prevEnd };
}

function filterByPeriod(items, dateKey, bounds) {
  return items.filter((item) => {
    const value = item?.[dateKey];
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date >= bounds.start && date <= bounds.end;
  });
}

function buildDashboardSnapshot({ orders, entries, expenses, label, year, month, filters }) {
  const currentBounds = getPeriodBounds(filters.period, year, month);
  const filteredOrders = filterByPeriod(orders, 'datetime', currentBounds);
  const filteredEntries = filterByPeriod(entries, 'date', currentBounds);
  const filteredExpenses = filterByPeriod(expenses, 'date', currentBounds);
  const revenue = filteredOrders.reduce((s, order) => s + (order.total || 0), 0);
  const extraEntries = filteredEntries.reduce((s, entry) => s + (entry.value || 0), 0);
  const expensesTotal = filteredExpenses.reduce((s, entry) => s + (entry.value || 0), 0);
  const income = revenue + extraEntries;
  const profit = income - expensesTotal;
  let comparison = null;
  if (filters.compare === 'previousMonth') {
    const prevBounds = getPreviousPeriodBounds(filters.period, year, month);
    const prevOrders = filterByPeriod(orders, 'datetime', prevBounds);
    const prevEntries = filterByPeriod(entries, 'date', prevBounds);
    const prevExpenses = filterByPeriod(expenses, 'date', prevBounds);
    const prevRevenue = prevOrders.reduce((s, order) => s + (order.total || 0), 0);
    const prevExtraEntries = prevEntries.reduce((s, entry) => s + (entry.value || 0), 0);
    const prevExpensesTotal = prevExpenses.reduce((s, entry) => s + (entry.value || 0), 0);
    const prevIncome = prevRevenue + prevExtraEntries;
    const prevProfit = prevIncome - prevExpensesTotal;
    comparison = {
      delta: profit - prevProfit,
      label: filters.period === 'month' ? 'mês anterior' : filters.period === 'year' ? 'ano anterior' : 'semana anterior',
      currentLabel: label,
      prevLabel: filters.period === 'month' ? `${month === 1 ? 'dezembro' : `mês ${month - 1}`}` : filters.period === 'year' ? `${year - 1}` : 'semana anterior',
    };
  }
  return {
    orders: filteredOrders,
    revenue,
    extraEntries,
    income,
    expenses: expensesTotal,
    profit,
    label,
    entries: filteredEntries,
    expensesData: filteredExpenses,
    comparison,
  };
}

export function renderDashboardPage(container, { year, month }) {
  destroyCharts();

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Central de Dashboards</h1>
      <p class="page-header__subtitle">Visão analítica para os sócios</p>
    </div>

    <div class="dashboard-switch">
      <div class="switch-group">
        <button class="switch-btn active" data-view="month">Visão do Mês Selecionado</button>
        <button class="switch-btn" data-view="total">Visão Geral (Histórico Total)</button>
      </div>
    </div>

    <div id="dashboardContent"></div>
  `;

  let currentView = 'month';
  let dashboardFilters = { period: 'month', compare: 'none' };

  const render = () => {
    destroyCharts();
    const content = container.querySelector('#dashboardContent');
    const dashboardData = currentView === 'month' ? getMonthData(year, month, dashboardFilters) : getTotalData();
    content.innerHTML = renderDashboardHTML(dashboardData, dashboardFilters);
    bindDashboardFilters(content, render, dashboardFilters);
    bindCharts(content, dashboardData);
  };

  container.querySelectorAll('.switch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.view;
      container.querySelectorAll('.switch-btn').forEach((b) => b.classList.toggle('active', b === btn));
      render();
    });
  });

  render();
}

function destroyCharts() {
  chartInstances.forEach((c) => c.destroy());
  chartInstances = [];
}

function getMonthData(year, month, filters = { period: 'month', compare: 'none' }) {
  const orders = getAllOrders().filter((o) => o.status !== 'cancelado');
  const entries = getAllCashflowEntries();
  const expensesData = getAllExpenses();
  const label = filters.period === 'year'
    ? `Ano ${year}`
    : filters.period === 'week'
      ? `Semana em ${monthLabel(year, month)}`
      : monthLabel(year, month);
  return buildDashboardSnapshot({
    orders,
    entries,
    expenses: expensesData,
    label,
    year,
    month,
    filters,
  });
}

function getTotalData() {
  const orders = getAllOrders().filter((o) => o.status !== 'cancelado');
  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const extraEntries = getAllCashflowEntries().reduce((s, entry) => s + (entry.value || 0), 0);
  const expenses = getAllExpenses().reduce((s, e) => s + (e.value || 0), 0);
  return {
    orders,
    revenue,
    extraEntries,
    income: revenue + extraEntries,
    expenses,
    profit: revenue + extraEntries - expenses,
    label: 'Histórico Total',
    entries: getAllCashflowEntries(),
    expensesData: getAllExpenses(),
  };
}

function renderDashboardHTML(data, filters) {
  if (!data.orders.length && !data.expenses && !data.extraEntries) {
    return emptyState('📊', 'Sem dados para exibir', 'Lance pedidos, entradas extras e despesas para ver os indicadores.');
  }

  const summaryItems = buildPeriodSummary(data);
  const topMovements = [...(data.entries || []), ...(data.expensesData || [])]
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 4);

  return `
    <p style="color:var(--text-secondary);margin-bottom:1rem;text-align:center">${escapeHtml(data.label)}</p>

    <div class="dashboard-filters">
      <div class="dashboard-filter-group">
        <label class="form-label">Período</label>
        <select class="form-select" id="periodFilter">
          <option value="week" ${filters.period === 'week' ? 'selected' : ''}>Semana</option>
          <option value="month" ${filters.period === 'month' ? 'selected' : ''}>Mês</option>
          <option value="year" ${filters.period === 'year' ? 'selected' : ''}>Ano</option>
        </select>
      </div>
      <div class="dashboard-filter-group">
        <label class="form-label">Comparar com</label>
        <select class="form-select" id="compareFilter">
          <option value="none" ${filters.compare === 'none' ? 'selected' : ''}>Nenhuma</option>
          <option value="previousMonth" ${filters.compare === 'previousMonth' ? 'selected' : ''}>Mês anterior</option>
        </select>
      </div>
      <button type="button" class="btn btn--secondary btn--sm" id="clearDashboardFilters">Limpar filtros</button>
    </div>

    <div class="dashboard-actions">
      <button type="button" class="btn btn--secondary btn--sm" id="exportCsvBtn">⬇ CSV</button>
      <button type="button" class="btn btn--secondary btn--sm" id="exportPdfBtn">🖨 PDF</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card stat-card--warm">
        <div class="stat-card__label">Receita Total</div>
        <div class="stat-card__value stat-card__value--warm">${formatMoney(data.income)}</div>
      </div>
      <div class="stat-card stat-card--red">
        <div class="stat-card__label">Custos Totais</div>
        <div class="stat-card__value stat-card__value--negative">${formatMoney(data.expenses)}</div>
      </div>
      <div class="stat-card stat-card--${data.profit >= 0 ? 'green' : 'red'} dashboard-profit-card">
        <div class="stat-card__label">Lucro Líquido</div>
        <div class="stat-card__value ${data.profit >= 0 ? 'stat-card__value--positive' : 'stat-card__value--negative'}">${formatMoney(data.profit)}</div>
        <div class="profit-badge ${data.profit >= 0 ? 'profit-badge--positive' : 'profit-badge--negative'}">${data.profit >= 0 ? 'Lucro positivo' : 'Lucro negativo'}</div>
      </div>
    </div>

    ${data.comparison ? `
      <div class="comparison-card comparison-card--${data.comparison.delta >= 0 ? 'positive' : 'negative'}">
        <span>Comparação ${escapeHtml(data.comparison.label)}</span>
        <strong>${data.comparison.delta >= 0 ? '+' : ''}${formatMoney(data.comparison.delta)}</strong>
        <small>${data.comparison.delta >= 0 ? 'acima do período anterior' : 'abaixo do período anterior'}</small>
      </div>` : ''}

    <div class="summary-grid">
      ${summaryItems.map((item) => `
        <div class="summary-card summary-card--${item.tone}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${formatMoney(item.value)}</strong>
        </div>`).join('')}
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-card__title">Top 5 Sabores Mais Pedidos</div>
        <div class="chart-container"><canvas id="chartFlavors"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-card__title">Tamanhos Mais Vendidos</div>
        <div class="chart-container"><canvas id="chartSizes"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-card__title">Canais de Venda</div>
        <div class="chart-container"><canvas id="chartChannels"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-card__title">Fluxo de Caixa</div>
        <div class="chart-container"><canvas id="chartCashflow"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-card__title">Despesas por Categoria</div>
        <div class="chart-container"><canvas id="chartExpenses"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-card__title">Entradas Extras</div>
        <div class="chart-container"><canvas id="chartEntries"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-card__title">Evolução do Lucro</div>
        <div class="chart-container"><canvas id="chartProfitTrend"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-card__title">Ranking de Sabores</div>
        <ul class="ranking-list" id="rankingList"></ul>
      </div>
      <div class="chart-card chart-card--wide">
        <div class="chart-card__title">Maiores Lançamentos</div>
        <ul class="ranking-list">
          ${topMovements.map((item) => `
            <li class="ranking-item">
              <span class="ranking-item__pos ${item.value >= 1000 ? 'ranking-item__pos--1' : ''}">${item.type === 'entrada' ? '↗' : '↘'}</span>
              <span class="ranking-item__name">${escapeHtml(item.description || item.category || 'Lançamento')}</span>
              <span class="ranking-item__count">${formatMoney(item.value || 0)}</span>
            </li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

function bindDashboardFilters(container, render, filters) {
  const periodFilter = container.querySelector('#periodFilter');
  const compareFilter = container.querySelector('#compareFilter');
  const clearBtn = container.querySelector('#clearDashboardFilters');

  periodFilter?.addEventListener('change', (event) => {
    filters.period = event.target.value;
    render();
  });
  compareFilter?.addEventListener('change', (event) => {
    filters.compare = event.target.value;
    render();
  });
  clearBtn?.addEventListener('click', () => {
    filters.period = 'month';
    filters.compare = 'none';
    render();
  });
}

function bindCharts(container, data) {
  const config = getConfig();
  const pizzaOrders = data.orders.filter((o) => o.type === 'pizza');

  const flavorCounts = {};
  pizzaOrders.forEach((o) => {
    flavorCounts[o.itemName] = (flavorCounts[o.itemName] || 0) + o.quantity;
  });
  const topFlavors = Object.entries(flavorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const sizeCounts = { P: 0, M: 0, G: 0, Lata: 0, '1L': 0 };
  data.orders.forEach((o) => {
    if (sizeCounts[o.size] !== undefined) sizeCounts[o.size] += o.quantity;
  });

  const channelCounts = {};
  data.orders.forEach((o) => {
    const ch = config.channels.find((c) => c.id === o.channelId);
    const name = ch ? ch.name : 'Outros';
    channelCounts[name] = (channelCounts[name] || 0) + 1;
  });

  const expenseCategoryCounts = {};
  const expenses = (data.expensesData || []).reduce((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + (entry.value || 0);
    return acc;
  }, {});
  Object.entries(expenses).forEach(([name, value]) => { expenseCategoryCounts[name] = value; });

  const entryCategoryCounts = {};
  const entries = (data.entries || []).reduce((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + (entry.value || 0);
    return acc;
  }, {});
  Object.entries(entries).forEach(([name, value]) => { entryCategoryCounts[name] = value; });

  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#9aa3b5', font: { family: 'DM Sans' } } } },
  };

  const flavorsCanvas = container.querySelector('#chartFlavors');
  if (flavorsCanvas && topFlavors.length) {
    chartInstances.push(new Chart(flavorsCanvas, {
      type: 'bar',
      data: {
        labels: topFlavors.map(([n]) => n),
        datasets: [{
          label: 'Quantidade',
          data: topFlavors.map(([, c]) => c),
          backgroundColor: 'rgba(245, 166, 35, 0.7)',
          borderColor: '#f5a623',
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: {
        ...chartDefaults,
        scales: {
          x: { ticks: { color: '#9aa3b5' }, grid: { color: '#2a3347' } },
          y: { ticks: { color: '#9aa3b5' }, grid: { color: '#2a3347' }, beginAtZero: true },
        },
      },
    }));
  } else if (flavorsCanvas) {
    flavorsCanvas.parentElement.innerHTML = emptyState('🍕', 'Sem dados de sabores');
  }

  const sizesCanvas = container.querySelector('#chartSizes');
  if (sizesCanvas) {
    const sizeLabels = Object.keys(sizeCounts).filter((k) => sizeCounts[k] > 0);
    if (sizeLabels.length) {
      chartInstances.push(new Chart(sizesCanvas, {
        type: 'doughnut',
        data: {
          labels: sizeLabels,
          datasets: [{
            data: sizeLabels.map((k) => sizeCounts[k]),
            backgroundColor: ['#2b7de9', '#4d9fff', '#1a5fb4', '#f5a623', '#e8871e'],
            borderWidth: 0,
          }],
        },
        options: chartDefaults,
      }));
    } else {
      sizesCanvas.parentElement.innerHTML = emptyState('📏', 'Sem dados de tamanhos');
    }
  }

  const channelsCanvas = container.querySelector('#chartChannels');
  if (channelsCanvas) {
    const chLabels = Object.keys(channelCounts);
    if (chLabels.length) {
      chartInstances.push(new Chart(channelsCanvas, {
        type: 'pie',
        data: {
          labels: chLabels,
          datasets: [{
            data: chLabels.map((k) => channelCounts[k]),
            backgroundColor: ['#22c55e', '#2b7de9', '#f5a623', '#ef4444', '#a855f7', '#06b6d4'],
            borderWidth: 0,
          }],
        },
        options: chartDefaults,
      }));
    } else {
      channelsCanvas.parentElement.innerHTML = emptyState('📱', 'Sem dados de canais');
    }
  }

  const cashflowCanvas = container.querySelector('#chartCashflow');
  if (cashflowCanvas) {
    chartInstances.push(new Chart(cashflowCanvas, {
      type: 'bar',
      data: {
        labels: ['Entradas', 'Saídas'],
        datasets: [{
          label: 'Valor (R$)',
          data: [data.income, data.expenses],
          backgroundColor: ['rgba(34, 197, 94, 0.7)', 'rgba(239, 68, 68, 0.7)'],
          borderColor: ['#22c55e', '#ef4444'],
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: {
        ...chartDefaults,
        scales: {
          x: { ticks: { color: '#9aa3b5' }, grid: { color: '#2a3347' } },
          y: { ticks: { color: '#9aa3b5' }, grid: { color: '#2a3347' }, beginAtZero: true },
        },
      },
    }));
  }

  const expensesCanvas = container.querySelector('#chartExpenses');
  if (expensesCanvas) {
    const labels = Object.keys(expenseCategoryCounts);
    if (labels.length) {
      chartInstances.push(new Chart(expensesCanvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: labels.map((k) => expenseCategoryCounts[k]),
            backgroundColor: ['#2b7de9', '#f5a623', '#22c55e', '#ef4444', '#a855f7', '#06b6d4', '#e8871e'],
            borderWidth: 0,
          }],
        },
        options: chartDefaults,
      }));
    } else {
      expensesCanvas.parentElement.innerHTML = emptyState('💸', 'Sem despesas');
    }
  }

  const entriesCanvas = container.querySelector('#chartEntries');
  if (entriesCanvas) {
    const labels = Object.keys(entryCategoryCounts);
    if (labels.length) {
      chartInstances.push(new Chart(entriesCanvas, {
        type: 'pie',
        data: {
          labels,
          datasets: [{
            data: labels.map((k) => entryCategoryCounts[k]),
            backgroundColor: ['#22c55e', '#2b7de9', '#f5a623', '#ef4444', '#a855f7', '#06b6d4'],
            borderWidth: 0,
          }],
        },
        options: chartDefaults,
      }));
    } else {
      entriesCanvas.parentElement.innerHTML = emptyState('💰', 'Sem entradas extras');
    }
  }

  const profitTrendCanvas = container.querySelector('#chartProfitTrend');
  if (profitTrendCanvas) {
    const trendLabels = [];
    const trendData = [];
    const history = getAllOrders().reduce((acc, order) => {
      const date = order.datetime ? order.datetime.split('T')[0] : '';
      if (!date) return acc;
      const monthKey = date.slice(0, 7);
      if (!acc[monthKey]) acc[monthKey] = { income: 0, expenses: 0 };
      acc[monthKey].income += Number(order.total || 0);
      return acc;
    }, {});
    const expenseHistory = getAllExpenses().reduce((acc, expense) => {
      const date = expense.date || '';
      if (!date) return acc;
      const monthKey = date.slice(0, 7);
      if (!acc[monthKey]) acc[monthKey] = 0;
      acc[monthKey] += Number(expense.value || 0);
      return acc;
    }, {});
    const entryHistory = getAllCashflowEntries().reduce((acc, entry) => {
      const date = entry.date || '';
      if (!date) return acc;
      const monthKey = date.slice(0, 7);
      if (!acc[monthKey]) acc[monthKey] = 0;
      acc[monthKey] += Number(entry.value || 0);
      return acc;
    }, {});
    const months = Array.from(new Set([...Object.keys(history), ...Object.keys(expenseHistory), ...Object.keys(entryHistory)])).sort().slice(-6);
    months.forEach((monthKey) => {
      const income = (history[monthKey]?.income || 0) + (entryHistory[monthKey] || 0);
      const expenses = (expenseHistory[monthKey] || 0);
      trendLabels.push(monthKey);
      trendData.push(income - expenses);
    });
    if (trendLabels.length) {
      chartInstances.push(new Chart(profitTrendCanvas, {
        type: 'line',
        data: {
          labels: trendLabels,
          datasets: [{
            label: 'Lucro',
            data: trendData,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            fill: true,
            tension: 0.35,
          }],
        },
        options: {
          ...chartDefaults,
          scales: {
            x: { ticks: { color: '#9aa3b5' }, grid: { color: '#2a3347' } },
            y: { ticks: { color: '#9aa3b5' }, grid: { color: '#2a3347' }, beginAtZero: true },
          },
        },
      }));
    } else {
      profitTrendCanvas.parentElement.innerHTML = emptyState('📈', 'Sem histórico');
    }
  }

  const rankingList = container.querySelector('#rankingList');
  const exportCsvBtn = container.querySelector('#exportCsvBtn');
  const exportPdfBtn = container.querySelector('#exportPdfBtn');
  exportCsvBtn?.addEventListener('click', () => exportDashboardCsv(data));
  exportPdfBtn?.addEventListener('click', () => exportDashboardPdf(data));

  if (rankingList) {
    if (topFlavors.length) {
      rankingList.innerHTML = topFlavors.map(([name, count], i) => `
        <li class="ranking-item">
          <span class="ranking-item__pos ${i === 0 ? 'ranking-item__pos--1' : ''}">${i + 1}</span>
          <span class="ranking-item__name">${escapeHtml(name)}</span>
          <span class="ranking-item__count">${count}x</span>
        </li>`).join('');
    } else {
      rankingList.innerHTML = '<li class="ranking-item"><span class="ranking-item__name" style="color:var(--text-muted)">Nenhum dado</span></li>';
    }
  }
}
