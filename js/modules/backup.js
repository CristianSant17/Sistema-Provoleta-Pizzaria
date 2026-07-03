/**
 * PROVOLETA — Backup + Exportação do cardápio público (JSON)
 */

import { exportAllData, importAllData, getConfig, getSettings, saveSettings } from '../storage.js';
import { buildPublicMenu, validatePublicMenu } from '../public-menu.js';
import { downloadJSON, escapeHtml } from '../utils.js';
import { PUBLIC_MENU_FILE, CLIENT_ORDER_PAGE, DEFAULT_WHATSAPP_FORMATTED } from '../constants.js';
import { toast } from '../ui.js';

export function renderBackupPage(container) {
  const settings = getSettings();
  const config = getConfig();
  const hasMenu = config.flavors.length > 0 || config.drinks.length > 0;
  const previewUrl = new URL(CLIENT_ORDER_PAGE, window.location.href).href;

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Backup e Exportação</h1>
      <p class="page-header__subtitle">Backup interno (LocalStorage) e exportação do cardápio JSON para o site público</p>
    </div>

    <!-- Cardápio público — fluxo principal -->
    <div class="card publish-card" style="margin-bottom:1.5rem">
      <div class="card__header">
        <h3 class="card__title">Cardápio Online — ${PUBLIC_MENU_FILE}</h3>
        <a href="${CLIENT_ORDER_PAGE}" target="_blank" rel="noopener" class="btn btn--secondary btn--sm">Visualizar pedido.html ↗</a>
      </div>

      <div class="publish-flow">
        <div class="publish-step"><span class="publish-step__num">1</span><span>Cadastre sabores, bebidas e bairros em <strong>Cadastros</strong></span></div>
        <div class="publish-step"><span class="publish-step__num">2</span><span>Configure a loja abaixo e exporte o JSON</span></div>
        <div class="publish-step"><span class="publish-step__num">3</span><span>Use o arquivo <code>${PUBLIC_MENU_FILE}</code> na pasta do site público</span></div>
        <div class="publish-step"><span class="publish-step__num">4</span><span>Clientes acessam apenas <code>${CLIENT_ORDER_PAGE}</code> — leem o JSON, sem LocalStorage</span></div>
      </div>

      <form id="storeExportForm" style="margin-top:1.25rem">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label class="form-label">Nome da loja (página do cliente)</label>
            <input class="form-input" name="storeName" value="${escapeHtml(settings.storeName)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">WhatsApp da loja</label>
            <input class="form-input" name="whatsapp" type="tel" value="${escapeHtml(settings.whatsapp)}" placeholder="${escapeHtml(DEFAULT_WHATSAPP_FORMATTED)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Horário</label>
            <input class="form-input" name="openHours" value="${escapeHtml(settings.openHours)}" placeholder="Seg a Dom · 18h às 23h">
          </div>
          <div class="form-group form-group--full">
            <label class="form-label">Mensagem de boas-vindas</label>
            <input class="form-input" name="welcomeMessage" value="${escapeHtml(settings.welcomeMessage)}">
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn--secondary" id="saveStorePrefs">Salvar preferências</button>
          <button type="button" class="btn btn--warm" id="exportPublicMenu" ${!hasMenu ? 'disabled' : ''}>
            ⬇ Exportar ${PUBLIC_MENU_FILE}
          </button>
        </div>
        ${!hasMenu ? '<p class="form-hint" style="margin-top:0.75rem;color:var(--warm-400)">Cadastre ao menos um sabor ou bebida antes de exportar.</p>' : ''}
      </form>
    </div>

    <div class="backup-grid">
      <div class="backup-card">
        <div class="backup-card__icon">💾</div>
        <h3 class="backup-card__title">Backup Completo (Gestão)</h3>
        <p class="backup-card__desc">
          Exporta todo o LocalStorage: cadastros, pedidos, caixa e estoque.
          Use para backup interno — <strong>não</strong> envie isso aos clientes.
        </p>
        <button class="btn btn--primary" id="btnDownloadBackup">Baixar backup interno</button>
      </div>

      <div class="backup-card">
        <div class="backup-card__icon">📂</div>
        <h3 class="backup-card__title">Restaurar Sistema</h3>
        <p class="backup-card__desc">
          Restaura backup interno completo no navegador da gestão.
        </p>
        <div class="file-upload" id="fileUploadArea">
          <div class="file-upload__icon">📁</div>
          <p>Arraste o backup ou clique para selecionar</p>
          <input type="file" id="backupFileInput" accept=".json,application/json">
        </div>
      </div>
    </div>

    <div class="backup-warning">
      <strong>Dois arquivos, dois propósitos</strong>
      <code>${PUBLIC_MENU_FILE}</code> → cardápio público para clientes (arquivo JSON exportado).
      <code>backup_provoleta_*.json</code> → dados completos da gestão (privado, LocalStorage).
    </div>
  `;

  container.querySelector('#saveStorePrefs').addEventListener('click', () => {
    const fd = new FormData(container.querySelector('#storeExportForm'));
    saveSettings({
      storeName: fd.get('storeName').trim(),
      whatsapp: fd.get('whatsapp').trim(),
      welcomeMessage: fd.get('welcomeMessage').trim(),
      openHours: fd.get('openHours').trim(),
    });
    toast('Preferências salvas (apenas neste navegador).', 'success');
  });

  container.querySelector('#exportPublicMenu').addEventListener('click', () => {
    const fd = new FormData(container.querySelector('#storeExportForm'));
    const storeSettings = {
      storeName: fd.get('storeName').trim(),
      whatsapp: fd.get('whatsapp').trim(),
      welcomeMessage: fd.get('welcomeMessage').trim(),
      openHours: fd.get('openHours').trim(),
    };
    saveSettings(storeSettings);

    const menu = buildPublicMenu(getConfig(), storeSettings);
    const check = validatePublicMenu(menu);
    if (!check.ok) {
      toast(check.error, 'error');
      return;
    }

    downloadJSON(menu, PUBLIC_MENU_FILE);
    toast(`${PUBLIC_MENU_FILE} exportado localmente para o site público.`, 'success');
  });

  container.querySelector('#btnDownloadBackup').addEventListener('click', () => {
    const data = exportAllData();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    downloadJSON(data, `backup_provoleta_${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}.json`);
    toast('Backup interno baixado!', 'success');
  });

  const fileInput = container.querySelector('#backupFileInput');
  const uploadArea = container.querySelector('#fileUploadArea');

  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleRestore(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleRestore(fileInput.files[0]); });
}

function handleRestore(file) {
  if (!file.name.endsWith('.json')) {
    toast('Selecione um arquivo .json de backup interno.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const backup = JSON.parse(e.target.result);
      const result = importAllData(backup);
      if (result.ok) {
        toast('Backup restaurado! Recarregando...', 'success');
        setTimeout(() => location.reload(), 1500);
      } else {
        toast(result.error, 'error');
      }
    } catch {
      toast('JSON malformado ou corrompido.', 'error');
    }
  };
  reader.readAsText(file);
}
