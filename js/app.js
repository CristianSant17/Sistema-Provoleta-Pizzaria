/**
 * PROVOLETA — Aplicação Principal
 * Router, estado global, seletor de mês e inicialização.
 */

import { getMeta, saveMeta } from './storage.js';
import { currentMonthRef, parseMonthRef } from './utils.js';
import { seedIfNeeded } from './seed.js';
import { renderOrdersPage } from './modules/orders.js';
import { renderConfigPage } from './modules/config.js';
import { renderCashflowPage } from './modules/cashflow.js';
import { renderMotoboysPage } from './modules/motoboys.js';
import { renderInventoryPage } from './modules/inventory.js';
import { renderDashboardPage } from './modules/dashboard.js';
import { renderBackupPage } from './modules/backup.js';

/** Estado global da aplicação */
const state = {
  currentPage: 'pedidos',
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
};

const AUTH_KEY = 'provoleta_admin_auth';
const AUTH_PASSWORD = 'JCProvoleta';

function isAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

function showAuthOverlay() {
  const overlay = document.getElementById('authOverlay');
  const card = document.getElementById('authCard');
  const app = document.getElementById('app');
  if (overlay) overlay.style.display = 'flex';
  if (app) app.classList.add('is-locked');
  if (card) {
    card.classList.remove('auth-card--error');
    void card.offsetWidth;
  }
}

function hideAuthOverlay() {
  const overlay = document.getElementById('authOverlay');
  const app = document.getElementById('app');
  if (overlay) overlay.style.display = 'none';
  if (app) app.classList.remove('is-locked');
}

function handleAuthSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('accessPassword');
  const card = document.getElementById('authCard');
  if (!input) return;

  if (input.value === AUTH_PASSWORD) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    hideAuthOverlay();
    navigate(state.currentPage);
    return;
  }

  if (card) {
    card.classList.remove('auth-card--error');
    void card.offsetWidth;
    card.classList.add('auth-card--error');
  }
  input.value = '';
  input.focus();
}

function logoutAdmin() {
  sessionStorage.removeItem(AUTH_KEY);
  showAuthOverlay();
  document.getElementById('mainContent').innerHTML = '';
}

/** Mapa de renderizadores por página */
const pages = {
  pedidos: (el) => renderOrdersPage(el, { year: state.year, month: state.month }),
  configuracoes: (el) => renderConfigPage(el),
  caixa: (el) => renderCashflowPage(el, { year: state.year, month: state.month }),
  motoboys: (el) => renderMotoboysPage(el, { year: state.year, month: state.month }),
  estoque: (el) => renderInventoryPage(el),
  dashboard: (el) => renderDashboardPage(el, { year: state.year, month: state.month }),
  backup: (el) => renderBackupPage(el),
};

/** Navega para uma página */
function navigate(page) {
  if (!pages[page]) return;
  state.currentPage = page;

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page active" id="page-${page}"></div>`;
  pages[page](document.getElementById(`page-${page}`));

  closeSidebar();
}

function setReferenceMonth(value) {
  const { year, month } = parseMonthRef(value);
  state.year = year;
  state.month = month;

  const meta = getMeta();
  meta.referenceMonth = value;
  saveMeta(meta);

  if (['pedidos', 'caixa', 'motoboys', 'dashboard'].includes(state.currentPage)) {
    navigate(state.currentPage);
  }
}

function updateClock() {
  const el = document.getElementById('currentDateTime');
  if (el) {
    el.textContent = new Date().toLocaleString('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('visible');
}

function initSidebar() {
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('visible');
  });
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
}

function initLogo() {
  const img = document.getElementById('logoImg');
  const fallback = document.getElementById('logoFallback');
  if (img.complete && img.naturalHeight === 0) {
    img.style.display = 'none';
    fallback.style.display = 'flex';
  }
}

function initPasswordToggle() {
  const input = document.getElementById('accessPassword');
  const toggle = document.getElementById('togglePassword');
  if (!input || !toggle) return;

  toggle.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(isPassword));
    toggle.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    toggle.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
    input.focus();
  });
}

async function init() {
  await seedIfNeeded();

  const meta = getMeta();
  const monthRef = meta.referenceMonth || currentMonthRef();
  const { year, month } = parseMonthRef(monthRef);
  state.year = year;
  state.month = month;

  const monthSelector = document.getElementById('monthSelector');
  monthSelector.value = monthRef;
  monthSelector.addEventListener('change', (e) => setReferenceMonth(e.target.value));

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!isAuthenticated()) {
        showAuthOverlay();
        return;
      }
      navigate(btn.dataset.page);
    });
  });

  document.getElementById('authForm')?.addEventListener('submit', handleAuthSubmit);
  document.getElementById('logoutBtn')?.addEventListener('click', logoutAdmin);

  initPasswordToggle();
  initSidebar();
  initLogo();
  updateClock();
  setInterval(updateClock, 30000);

  if (!isAuthenticated()) {
    showAuthOverlay();
    return;
  }

  hideAuthOverlay();
  navigate('pedidos');
}

document.addEventListener('DOMContentLoaded', init);
