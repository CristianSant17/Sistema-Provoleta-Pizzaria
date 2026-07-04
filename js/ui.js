/**
 * PROVOLETA — UI Helpers (Toast, Modal, Tabs)
 */

import { escapeHtml } from './utils.js';

/** Exibe toast de notificação */
export function toast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(100%)';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

/** Abre modal com conteúdo */
export function openModal({ title, body, footer, onClose }) {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = title;
  const bodyEl = document.getElementById('modalBody');
  const footerEl = document.getElementById('modalFooter');

  bodyEl.innerHTML = typeof body === 'string' ? body : '';
  if (body instanceof HTMLElement) {
    bodyEl.innerHTML = '';
    bodyEl.appendChild(body);
  }

  footerEl.innerHTML = footer || '';

  overlay.classList.add('visible');

  const close = () => {
    overlay.classList.remove('visible');
    if (onClose) onClose();
  };

  document.getElementById('modalClose').onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  return { close, bodyEl, footerEl };
}

/** Modal de confirmação */
export function confirmModal({ title, message, confirmText = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    const footer = `
      <button class="btn btn--secondary" id="modalCancel">Cancelar</button>
      <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" id="modalConfirm">${escapeHtml(confirmText)}</button>
    `;
    const { close } = openModal({ title, body: `<p>${escapeHtml(message)}</p>`, footer });

    document.getElementById('modalCancel').onclick = () => { close(); resolve(false); };
    document.getElementById('modalConfirm').onclick = () => { close(); resolve(true); };
  });
}

/** Inicializa tabs internas de uma página */
export function initTabs(container) {
  const tabs = container.querySelectorAll('.tab-btn');
  const panels = container.querySelectorAll('.tab-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === target));
      panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === target));
    });
  });
}

/** Renderiza estado vazio */
export function emptyState(icon, title, subtitle = '') {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">${icon}</div>
      <div class="empty-state__title">${escapeHtml(title)}</div>
      ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
    </div>
  `;
}

/** Paginação HTML */
export function renderPagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return document.createElement('div');

  const container = document.createElement('div');
  container.className = 'pagination';
  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;

  container.innerHTML = `
    <button class="btn btn--secondary btn--sm" ${!prev ? 'disabled' : ''} data-page="${prev || ''}">← Anterior</button>
    <span class="pagination__info">Página ${page} de ${totalPages}</span>
    <button class="btn btn--secondary btn--sm" ${!next ? 'disabled' : ''} data-page="${next || ''}">Próxima →</button>
  `;

  container.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page, 10);
      if (p) onPageChange(p);
    });
  });

  return container;
}

/** Tag de status do pedido */
export function statusTag(status) {
  const cls = { pendente: 'pending', em_preparo: 'preparing', entregue: 'delivered', cancelado: 'cancelled' };
  const labels = { pendente: 'Pendente', em_preparo: 'Em preparo', entregue: 'Entregue', cancelado: 'Cancelado' };
  return `<span class="tag tag--${cls[status] || 'pending'}">${labels[status] || status}</span>`;
}

/** Botões padrão Editar + Excluir em tabelas */
export function tableActions(editAttr, deleteAttr) {
  return `
    <div class="table-actions">
      <button type="button" class="btn btn--edit btn--sm" ${editAttr}>Editar</button>
      <button type="button" class="btn btn--danger btn--sm" ${deleteAttr}>Excluir</button>
    </div>`;
}

/** Modal largo para formulários complexos */
export function setModalSize(size = 'default') {
  const modal = document.getElementById('modal');
  modal.classList.toggle('modal--wide', size === 'wide');
  modal.classList.toggle('modal--xl', size === 'xl');
}

/**
 * Abre modal com formulário editável.
 * onSubmit(form, FormData) — retorne false para não fechar.
 */
export function openFormModal({ title, formHtml, submitLabel = 'Salvar alterações', wide = false, onSubmit }) {
  setModalSize(wide ? 'wide' : 'default');

  const footer = `
    <button type="button" class="btn btn--secondary" id="modalCancel">Cancelar</button>
    <button type="submit" form="editModalForm" class="btn btn--primary">${escapeHtml(submitLabel)}</button>
  `;

  const { close, bodyEl } = openModal({
    title,
    body: `<form id="editModalForm" class="edit-form">${formHtml}</form>`,
    footer,
  });

  const form = bodyEl.querySelector('#editModalForm');

  document.getElementById('modalCancel').onclick = () => close();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const result = onSubmit(form, new FormData(form));
    if (result !== false) close();
  });

  return { close, form };
}
