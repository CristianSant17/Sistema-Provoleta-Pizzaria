/**
 * PROVOLETA — Central de Dashboards
 * Visão mensal e histórico total com gráficos Chart.js.
 */

import {
  getOrders, getCashflow, calcMonthRevenue, getAllOrders, getAllExpenses,
  getConfig,
} from '../storage.js';
import { formatMoney, escapeHtml, monthLabel } from '../utils.js';
import { emptyState } from '../ui.js';

let chartInstances = [];

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

  const render = () => {
    destroyCharts();
    const content = container.querySelector('#dashboardContent');
    if (currentView === 'month') {
      content.innerHTML = renderMonthView(year, month);
    } else {
      content.innerHTML = renderTotalView();
    }
    bindCharts(content, currentView === 'month' ? getMonthData(year, month) : getTotalData());
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

function getMonthData(year, month) {
  const orders = getOrders(year, month).filter((o) => o.status !== 'cancelado');
  const revenue = calcMonthRevenue(year, month);
  const expenses = (getCashflow(year, month).expenses || []).reduce((s, e) => s + e.value, 0);
  return { orders, revenue, expenses, profit: revenue - expenses, label: monthLabel(year, month) };
}

function getTotalData() {
  const orders = getAllOrders().filter((o) => o.status !== 'cancelado');
  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const expenses = getAllExpenses().reduce((s, e) => s + (e.value || 0), 0);
  return { orders, revenue, expenses, profit: revenue - expenses, label: 'Histórico Total' };
}

function renderMonthView(year, month) {
  const data = getMonthData(year, month);
  return renderDashboardHTML(data);
}

function renderTotalView() {
  return renderDashboardHTML(getTotalData());
}

function renderDashboardHTML(data) {
  if (!data.orders.length && !data.expenses) {
    return emptyState('📊', 'Sem dados para exibir', 'Lance pedidos e despesas para ver os indicadores.');
  }

  return `
    <p style="color:var(--text-secondary);margin-bottom:1rem;text-align:center">${escapeHtml(data.label)}</p>

    <div class="stats-grid">
      <div class="stat-card stat-card--warm">
        <div class="stat-card__label">Faturamento Bruto</div>
        <div class="stat-card__value stat-card__value--warm">${formatMoney(data.revenue)}</div>
      </div>
      <div class="stat-card stat-card--red">
        <div class="stat-card__label">Custos Totais</div>
        <div class="stat-card__value stat-card__value--negative">${formatMoney(data.expenses)}</div>
      </div>
      <div class="stat-card stat-card--${data.profit >= 0 ? 'green' : 'red'}">
        <div class="stat-card__label">Lucro Líquido</div>
        <div class="stat-card__value ${data.profit >= 0 ? 'stat-card__value--positive' : 'stat-card__value--negative'}">${formatMoney(data.profit)}</div>
      </div>
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
        <div class="chart-card__title">Ranking de Sabores</div>
        <ul class="ranking-list" id="rankingList"></ul>
      </div>
    </div>
  `;
}

function bindCharts(container, data) {
  const config = getConfig();
  const pizzaOrders = data.orders.filter((o) => o.type === 'pizza');

  // Top sabores
  const flavorCounts = {};
  pizzaOrders.forEach((o) => {
    flavorCounts[o.itemName] = (flavorCounts[o.itemName] || 0) + o.quantity;
  });
  const topFlavors = Object.entries(flavorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Tamanhos
  const sizeCounts = { P: 0, M: 0, G: 0, Lata: 0, '1L': 0 };
  data.orders.forEach((o) => {
    if (sizeCounts[o.size] !== undefined) sizeCounts[o.size] += o.quantity;
  });

  // Canais
  const channelCounts = {};
  data.orders.forEach((o) => {
    const ch = config.channels.find((c) => c.id === o.channelId);
    const name = ch ? ch.name : 'Outros';
    channelCounts[name] = (channelCounts[name] || 0) + 1;
  });

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

  const rankingList = container.querySelector('#rankingList');
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
