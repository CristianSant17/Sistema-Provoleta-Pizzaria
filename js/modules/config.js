/**
 * PROVOLETA — Módulo de Cadastros e Configurações
 * CRUD completo: criar, editar e excluir.
 */

import { getConfig, saveConfig, getPublicMenuSnapshot, savePublicMenuSnapshot, getSettings } from '../storage.js';
import { buildPublicMenu } from '../public-menu.js';
import { uid, escapeHtml, parseMoney } from '../utils.js';
import { toast, confirmModal, initTabs, emptyState, tableActions, openFormModal } from '../ui.js';

let activeTab = 'categorias';
let _configGlobalListenersAttached = false;

function parseExtraImages(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseIngredients(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function renderConfigPage(container) {
  const config = getConfig();
  const publicMenu = getPublicMenuSnapshot();
  // If no coupons in local config but public snapshot has them, surface them in the admin UI for visibility.
  if ((!config.coupons || !config.coupons.length) && publicMenu?.coupons?.length) {
    config.coupons = publicMenu.coupons.map((c) => ({ ...c }));
    // Persist imported coupons so edit/delete operations work on the actual config
    saveConfig(config);
  }
  const hasPendingChanges = !publicMenu || JSON.stringify(publicMenu) !== JSON.stringify(buildPublicMenu(config, getSettings()));

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Cadastros e Configurações</h1>
      <p class="page-header__subtitle">Gerencie categorias, sabores, bebidas, logística e equipe</p>
    </div>

    <div class="card config-section config-publish-card">
      <div class="card__header">
        <h3 class="card__title">Cardápio Público</h3>
          <span class="tag ${hasPendingChanges ? 'tag--pending' : 'tag--ok'}">${hasPendingChanges ? 'Alterações pendentes' : 'Atualizado'}</span>
      </div>
        <p class="form-hint">Cada alteração salva aqui atualiza o payload local do cardápio público para exportação e uso no site.</p>
        <button type="button" class="btn btn--primary" id="publishMenuBtn">Atualizar e exportar cardápio público</button>
    </div>

    <div class="tabs" id="configTabs">
      <button class="tab-btn ${activeTab === 'categorias' ? 'active' : ''}" data-tab="categorias">Categorias</button>
      <button class="tab-btn ${activeTab === 'sabores' ? 'active' : ''}" data-tab="sabores">Sabores</button>
      <button class="tab-btn ${activeTab === 'bebidas' ? 'active' : ''}" data-tab="bebidas">Bebidas</button>
      <button class="tab-btn ${activeTab === 'logistica' ? 'active' : ''}" data-tab="logistica">Logística</button>
      <button class="tab-btn ${activeTab === 'equipe' ? 'active' : ''}" data-tab="equipe">Equipe e Canais</button>
      <button class="tab-btn ${activeTab === 'cupons' ? 'active' : ''}" data-tab="cupons">Cupons</button>
    </div>

    <div class="tab-panel ${activeTab === 'categorias' ? 'active' : ''}" data-panel="categorias">${renderCategoriesPanel(config)}</div>
    <div class="tab-panel ${activeTab === 'sabores' ? 'active' : ''}" data-panel="sabores">${renderFlavorsPanel(config)}</div>
    <div class="tab-panel ${activeTab === 'bebidas' ? 'active' : ''}" data-panel="bebidas">${renderDrinksPanel(config)}</div>
    <div class="tab-panel ${activeTab === 'logistica' ? 'active' : ''}" data-panel="logistica">${renderLogisticsPanel(config)}</div>
    <div class="tab-panel ${activeTab === 'equipe' ? 'active' : ''}" data-panel="equipe">${renderTeamPanel(config)}</div>
    <div class="tab-panel ${activeTab === 'cupons' ? 'active' : ''}" data-panel="cupons">${renderCouponsPanel(config)}</div>
  `;

  initTabs(container);
  container.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => { activeTab = btn.dataset.tab; });
  });

  // Attach direct listeners for coupon edit/delete buttons to ensure reliable behavior
  (container.querySelectorAll('[data-edit-coupon]') || []).forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-edit-coupon');
      const config = getConfig();
      const item = (config.coupons || []).find((c) => c.id === id);
      if (!item) { toast('Cupom não encontrado.', 'error'); return; }
      openFormModal({
        title: 'Editar Cupom',
        formHtml: `
          <div class="form-grid">
            <div class="form-group form-group--full"><label class="form-label">Código</label>
              <input class="form-input" name="code" value="${escapeHtml(item.code)}" required></div>
            <div class="form-group form-group--full"><label class="form-label">Descrição</label>
              <input class="form-input" name="description" value="${escapeHtml(item.description || '')}"></div>
            <div class="form-group"><label class="form-label">Tipo</label>
              <select class="form-select" name="type">
                <option value="" ${item.type === '' ? 'selected' : ''}>Sem desconto</option>
                <option value="percent" ${item.type === 'percent' ? 'selected' : ''}>Porcentagem</option>
                <option value="fixed" ${item.type === 'fixed' ? 'selected' : ''}>Valor fixo</option>
              </select></div>
            <div class="form-group"><label class="form-label">Valor</label>
              <input class="form-input" name="value" type="number" step="0.01" min="0" value="${item.value || ''}"></div>
            <div class="form-group"><label class="form-label">Valor mínimo do pedido</label>
              <input class="form-input" name="minOrderValue" type="number" step="0.01" min="0" value="${item.minOrderValue || ''}"></div>
            <div class="form-group form-group--full"><label class="form-label">Produtos específicos</label>
              <input class="form-input" name="productIds" value="${escapeHtml((item.productIds || []).join(', '))}" placeholder="IDs separados por vírgula"></div>
            <div class="form-group"><label class="form-label">Validade</label>
              <input class="form-input" name="expiresAt" type="date" value="${item.expiresAt ? item.expiresAt.split('T')[0] : ''}"></div>
            <div class="form-group form-group--full">
              <label class="form-label checkbox-label">
                <input type="checkbox" name="active" value="1" ${item.active ? 'checked' : ''}> Cupom ativo
              </label>
            </div>
            <div class="form-group form-group--full">
              <label class="form-label checkbox-label">
                <input type="checkbox" name="freeShipping" value="1" ${item.freeShipping ? 'checked' : ''}> Frete grátis
              </label>
            </div>
          </div>`,
        onSubmit: (_, fd) => {
          item.code = fd.get('code').trim();
          item.description = fd.get('description').trim();
          item.type = fd.get('type');
          item.value = parseMoney(fd.get('value'));
          item.minOrderValue = parseMoney(fd.get('minOrderValue'));
          item.productIds = parseIngredients(fd.get('productIds'));
          item.expiresAt = fd.get('expiresAt') ? new Date(fd.get('expiresAt')).toISOString() : '';
          item.active = !!fd.get('active');
          item.freeShipping = !!fd.get('freeShipping');
          saveConfig(config);
          toast('Cupom atualizado!', 'success');
          renderConfigPage(container);
        },
      });
    });

  // Add a single document-level fallback listener once to catch clicks that miss local handlers
  if (!_configGlobalListenersAttached) {
    _configGlobalListenersAttached = true;
    document.addEventListener('click', async (e) => {
      const editEl = e.target.closest && e.target.closest('[data-edit-coupon]');
      if (editEl) {
        e.stopPropagation();
        const id = editEl.getAttribute('data-edit-coupon');
        const config = getConfig();
        const item = (config.coupons || []).find((c) => c.id === id);
        if (!item) { toast('Cupom não encontrado.', 'error'); return; }
        openFormModal({
          title: 'Editar Cupom',
          formHtml: `
            <div class="form-grid">
              <div class="form-group form-group--full"><label class="form-label">Código</label>
                <input class="form-input" name="code" value="${escapeHtml(item.code)}" required></div>
              <div class="form-group form-group--full"><label class="form-label">Descrição</label>
                <input class="form-input" name="description" value="${escapeHtml(item.description || '')}"></div>
              <div class="form-group"><label class="form-label">Tipo</label>
                <select class="form-select" name="type">
                  <option value="" ${item.type === '' ? 'selected' : ''}>Sem desconto</option>
                  <option value="percent" ${item.type === 'percent' ? 'selected' : ''}>Porcentagem</option>
                  <option value="fixed" ${item.type === 'fixed' ? 'selected' : ''}>Valor fixo</option>
                </select></div>
              <div class="form-group"><label class="form-label">Valor</label>
                <input class="form-input" name="value" type="number" step="0.01" min="0" value="${item.value || ''}"></div>
              <div class="form-group"><label class="form-label">Valor mínimo do pedido</label>
                <input class="form-input" name="minOrderValue" type="number" step="0.01" min="0" value="${item.minOrderValue || ''}"></div>
              <div class="form-group form-group--full"><label class="form-label">Produtos específicos</label>
                <input class="form-input" name="productIds" value="${escapeHtml((item.productIds || []).join(', '))}" placeholder="IDs separados por vírgula"></div>
              <div class="form-group"><label class="form-label">Validade</label>
                <input class="form-input" name="expiresAt" type="date" value="${item.expiresAt ? item.expiresAt.split('T')[0] : ''}"></div>
              <div class="form-group form-group--full">
                <label class="form-label checkbox-label">
                  <input type="checkbox" name="active" value="1" ${item.active ? 'checked' : ''}> Cupom ativo
                </label>
              </div>
              <div class="form-group form-group--full">
                <label class="form-label checkbox-label">
                  <input type="checkbox" name="freeShipping" value="1" ${item.freeShipping ? 'checked' : ''}> Frete grátis
                </label>
              </div>
            </div>`,
          onSubmit: (_, fd) => {
            item.code = fd.get('code').trim();
            item.description = fd.get('description').trim();
            item.type = fd.get('type');
            item.value = parseMoney(fd.get('value'));
            item.minOrderValue = parseMoney(fd.get('minOrderValue'));
            item.productIds = parseIngredients(fd.get('productIds'));
            item.expiresAt = fd.get('expiresAt') ? new Date(fd.get('expiresAt')).toISOString() : '';
            item.active = !!fd.get('active');
            item.freeShipping = !!fd.get('freeShipping');
            saveConfig(config);
            toast('Cupom atualizado!', 'success');
            renderConfigPage(document.querySelector('.page.active') || document.getElementById('mainContent'));
          },
        });
        return;
      }
      const deleteEl = e.target.closest && e.target.closest('[data-delete-coupon]');
      if (deleteEl) {
        e.stopPropagation();
        const id = deleteEl.getAttribute('data-delete-coupon');
        const config = getConfig();
        if (!id) return;
        if (await confirmModal({ title: 'Excluir Cupom', message: 'Confirma a exclusão?', danger: true })) {
          config.coupons = (config.coupons || []).filter((coupon) => coupon.id !== id);
          saveConfig(config);
          toast('Cupom excluído.', 'info');
          renderConfigPage(document.querySelector('.page.active') || document.getElementById('mainContent'));
        }
        return;
      }
    });
  }
  });

  (container.querySelectorAll('[data-delete-coupon]') || []).forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-delete-coupon');
      const config = getConfig();
      if (!id) return;
      if (await confirmModal({ title: 'Excluir Cupom', message: 'Confirma a exclusão?', danger: true })) {
        config.coupons = (config.coupons || []).filter((coupon) => coupon.id !== id);
        saveConfig(config);
        toast('Cupom excluído.', 'info');
        renderConfigPage(container);
      }
    });
  });
  bindConfigEvents(container);
}

function renderCategoriesPanel(config) {
  const rows = config.categories.map((c) => `
    <tr>
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td>R$ ${c.priceP.toFixed(2)}</td>
      <td>R$ ${c.priceM.toFixed(2)}</td>
      <td>R$ ${c.priceG.toFixed(2)}</td>
      <td>${tableActions(`data-edit-cat="${c.id}"`, `data-delete-cat="${c.id}"`)}</td>
    </tr>`).join('');

  return `
    <div class="card config-section">
      <div class="card__header"><h3 class="card__title">Categorias de Pizza</h3></div>
      <form id="formCategory" class="inline-form">
        <div class="form-group"><label class="form-label">Nome da Categoria</label>
          <input class="form-input" name="name" required placeholder="Ex: Tradicional"></div>
        <div class="form-group"><label class="form-label">Preço P</label>
          <input class="form-input" name="priceP" type="number" step="0.01" min="0" required></div>
        <div class="form-group"><label class="form-label">Preço M</label>
          <input class="form-input" name="priceM" type="number" step="0.01" min="0" required></div>
        <div class="form-group"><label class="form-label">Preço G</label>
          <input class="form-input" name="priceG" type="number" step="0.01" min="0" required></div>
        <button type="submit" class="btn btn--primary">+ Adicionar</button>
      </form>
      ${config.categories.length ? `
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Categoria</th><th>P</th><th>M</th><th>G</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>` : emptyState('🍕', 'Nenhuma categoria cadastrada')}
    </div>`;
}

function renderFlavorsPanel(config) {
  const catOptions = config.categories.map((c) =>
    `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  const rows = config.flavors.map((f) => {
    const cat = config.categories.find((c) => c.id === f.categoryId);
    const imageCount = (f.extraImages?.length || 0) + (f.imageUrl ? 1 : 0);
    return `<tr>
      <td><strong>${escapeHtml(f.name)}</strong></td>
      <td>${cat ? escapeHtml(cat.name) : '—'}</td>
      <td>${imageCount ? `<span class="tag tag--ok">${imageCount} foto${imageCount > 1 ? 's' : ''}</span>` : '<span class="tag tag--pending">Sem imagem</span>'}</td>
      <td>${tableActions(`data-edit-flavor="${f.id}"`, `data-delete-flavor="${f.id}"`)}</td>
    </tr>`;
  }).join('');

  return `
    <div class="card config-section">
      <div class="card__header"><h3 class="card__title">Sabores de Pizza</h3></div>
      <form id="formFlavor" class="inline-form">
        <div class="form-group"><label class="form-label">Nome do Sabor</label>
          <input class="form-input" name="name" required placeholder="Ex: Calabresa"></div>
        <div class="form-group"><label class="form-label">Categoria</label>
          <select class="form-select" name="categoryId" required ${!config.categories.length ? 'disabled' : ''}>
            <option value="">Selecione...</option>${catOptions}
          </select></div>
        <div class="form-group form-group--full"><label class="form-label">Ingredientes (separados por vírgula)</label>
          <input class="form-input" name="ingredients" placeholder="mussarela, frango, milho"></div>
        <div class="form-group form-group--full"><label class="form-label">Link da Imagem (opcional)</label>
          <input class="form-input" name="imageUrl" placeholder="https://... ou /assets/..."></div>
        <button type="submit" class="btn btn--primary" ${!config.categories.length ? 'disabled' : ''}>+ Adicionar</button>
      </form>
      ${config.flavors.length ? `
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Sabor</th><th>Categoria</th><th>Imagem</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>` : emptyState('🧀', 'Nenhum sabor cadastrado')}
    </div>`;
}

function renderDrinksPanel(config) {
  const rows = config.drinks.map((d) => `
    <tr>
      <td><strong>${escapeHtml(d.name)}</strong></td>
      <td>R$ ${d.priceLata.toFixed(2)}</td>
      <td>R$ ${d.price1L.toFixed(2)}</td>
      <td>${d.imageUrl ? '<span class="tag tag--ok">Com imagem</span>' : '<span class="tag tag--pending">Sem imagem</span>'}</td>
      <td>${tableActions(`data-edit-drink="${d.id}"`, `data-delete-drink="${d.id}"`)}</td>
    </tr>`).join('');

  return `
    <div class="card config-section">
      <div class="card__header"><h3 class="card__title">Bebidas</h3></div>
      <form id="formDrink" class="inline-form">
        <div class="form-group"><label class="form-label">Nome da Bebida</label>
          <input class="form-input" name="name" required placeholder="Ex: Coca-Cola"></div>
        <div class="form-group"><label class="form-label">Preço Lata</label>
          <input class="form-input" name="priceLata" type="number" step="0.01" min="0" required></div>
        <div class="form-group"><label class="form-label">Preço 1 Litro</label>
          <input class="form-input" name="price1L" type="number" step="0.01" min="0" required></div>
        <div class="form-group form-group--full"><label class="form-label">Link da Imagem (opcional)</label>
          <input class="form-input" name="imageUrl" placeholder="https://... ou /assets/..."></div>
        <button type="submit" class="btn btn--primary">+ Adicionar</button>
      </form>
      ${config.drinks.length ? `
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Bebida</th><th>Lata</th><th>1 Litro</th><th>Imagem</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>` : emptyState('🥤', 'Nenhuma bebida cadastrada')}
    </div>`;
}

function renderLogisticsPanel(config) {
  const rows = config.neighborhoods.map((n) => `
    <tr>
      <td><strong>${escapeHtml(n.name)}</strong></td>
      <td>R$ ${n.fee.toFixed(2)}</td>
      <td>${tableActions(`data-edit-neighborhood="${n.id}"`, `data-delete-neighborhood="${n.id}"`)}</td>
    </tr>`).join('');

  return `
    <div class="card config-section">
      <div class="card__header"><h3 class="card__title">Bairros e Taxas de Entrega</h3></div>
      <form id="formNeighborhood" class="inline-form">
        <div class="form-group"><label class="form-label">Bairro</label>
          <input class="form-input" name="name" required placeholder="Ex: Centro"></div>
        <div class="form-group"><label class="form-label">Taxa de Entrega (R$)</label>
          <input class="form-input" name="fee" type="number" step="0.01" min="0" required></div>
        <button type="submit" class="btn btn--primary">+ Adicionar</button>
      </form>
      ${config.neighborhoods.length ? `
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Bairro</th><th>Taxa</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>` : emptyState('📍', 'Nenhum bairro cadastrado')}
    </div>`;
}

function renderTeamPanel(config) {
  const motoboyRows = config.motoboys.map((m) => `
    <tr>
      <td><strong>${escapeHtml(m.name)}</strong></td>
      <td>${m.active ? '<span class="tag tag--ok">Ativo</span>' : '<span class="tag tag--alert">Inativo</span>'}</td>
      <td>${tableActions(`data-edit-motoboy="${m.id}"`, `data-delete-motoboy="${m.id}"`)}</td>
    </tr>`).join('');

  const channelRows = config.channels.map((c) => `
    <tr>
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td>${tableActions(`data-edit-channel="${c.id}"`, `data-delete-channel="${c.id}"`)}</td>
    </tr>`).join('');

  const additionalRows = (config.additionals || []).map((a) => `
    <tr>
      <td><strong>${escapeHtml(a.name)}</strong></td>
      <td>R$ ${parseMoney(a.price).toFixed(2)}</td>
      <td>${tableActions(`data-edit-additional="${a.id}"`, `data-delete-additional="${a.id}"`)}</td>
    </tr>`).join('');

  return `
    <div class="card config-section">
      <div class="card__header"><h3 class="card__title">Motoboys</h3></div>
      <form id="formMotoboy" class="inline-form">
        <div class="form-group"><label class="form-label">Nome do Motoboy</label>
          <input class="form-input" name="name" required placeholder="Ex: Cristian"></div>
        <button type="submit" class="btn btn--primary">+ Adicionar</button>
      </form>
      ${config.motoboys.length ? `
        <div class="table-wrapper" style="margin-bottom:2rem"><table class="data-table">
          <thead><tr><th>Nome</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${motoboyRows}</tbody>
        </table></div>` : emptyState('🏍️', 'Nenhum motoboy cadastrado')}
    </div>
    <div class="card config-section">
      <div class="card__header"><h3 class="card__title">Canais de Venda</h3></div>
      <form id="formChannel" class="inline-form">
        <div class="form-group"><label class="form-label">Canal</label>
          <input class="form-input" name="name" required placeholder="Ex: WhatsApp"></div>
        <button type="submit" class="btn btn--primary">+ Adicionar</button>
      </form>
      ${config.channels.length ? `
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Canal</th><th>Ações</th></tr></thead>
          <tbody>${channelRows}</tbody>
        </table></div>` : emptyState('📱', 'Nenhum canal cadastrado')}
    </div>
    <div class="card config-section">
      <div class="card__header"><h3 class="card__title">Adicionais / Bordas</h3></div>
      <form id="formAdditional" class="inline-form">
        <div class="form-group"><label class="form-label">Nome</label>
          <input class="form-input" name="name" required placeholder="Ex: Borda de Catupiry"></div>
        <div class="form-group"><label class="form-label">Preço</label>
          <input class="form-input" name="price" type="number" step="0.01" min="0" required></div>
        <button type="submit" class="btn btn--primary">+ Adicionar</button>
      </form>
      ${config.additionals?.length ? `
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Adicional</th><th>Preço</th><th>Ações</th></tr></thead>
          <tbody>${additionalRows}</tbody>
        </table></div>` : emptyState('🧀', 'Nenhum adicional cadastrado')}
    </div>`;
}

function renderCouponsPanel(config) {
  const rows = (config.coupons || []).map((coupon) => {
    const details = [];
    if (coupon.type === 'percent' && coupon.value) details.push(`${coupon.value}%`);
    if (coupon.type === 'fixed' && coupon.value) details.push(`R$ ${parseMoney(coupon.value).toFixed(2)}`);
    if (coupon.freeShipping) details.push('Frete grátis');
    if (coupon.minOrderValue) details.push(`A partir de R$ ${parseMoney(coupon.minOrderValue).toFixed(2)}`);
    if (coupon.productIds?.length) details.push('Produtos específicos');
    return `
      <tr>
        <td><strong>${escapeHtml(coupon.code)}</strong></td>
        <td>${coupon.active ? '<span class="tag tag--ok">Ativo</span>' : '<span class="tag tag--pending">Inativo</span>'}</td>
        <td>${escapeHtml(coupon.description || details.join(' · ') || '—')}</td>
        <td>${details.join(' · ')}</td>
        <td>${tableActions(`data-edit-coupon="${coupon.id}"`, `data-delete-coupon="${coupon.id}"`)}</td>
      </tr>`;
  }).join('');

  return `
    <div class="card config-section">
      <div class="card__header"><h3 class="card__title">Cupons</h3></div>
      <form id="formCoupon" class="inline-form">
        <div class="form-group"><label class="form-label">Código do cupom</label>
          <input class="form-input" name="code" required placeholder="Ex: PROVOLETA10"></div>
        <div class="form-group"><label class="form-label">Descrição</label>
          <input class="form-input" name="description" placeholder="Ex: 10% de desconto no pedido"></div>
        <div class="form-group"><label class="form-label">Tipo</label>
          <select class="form-select" name="type">
            <option value="">Sem desconto</option>
            <option value="percent">Porcentagem</option>
            <option value="fixed">Valor fixo</option>
          </select></div>
        <div class="form-group"><label class="form-label">Valor</label>
          <input class="form-input" name="value" type="number" step="0.01" min="0" placeholder="10"></div>
        <div class="form-group"><label class="form-label">Valor mínimo do pedido</label>
          <input class="form-input" name="minOrderValue" type="number" step="0.01" min="0" placeholder="0"></div>
        <div class="form-group"><label class="form-label">Produtos específicos</label>
          <input class="form-input" name="productIds" placeholder="IDs separados por vírgula"></div>
        <div class="form-group"><label class="form-label">Validade</label>
          <input class="form-input" name="expiresAt" type="date"></div>
        <div class="form-group form-group--full">
          <label class="form-label checkbox-label">
            <input type="checkbox" name="active" value="1" checked> Cupom ativo
          </label>
        </div>
        <div class="form-group form-group--full">
          <label class="form-label checkbox-label">
            <input type="checkbox" name="freeShipping" value="1"> Frete grátis
          </label>
        </div>
        <button type="submit" class="btn btn--primary">+ Adicionar</button>
      </form>
      ${rows.length ? `
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Cupom</th><th>Status</th><th>Descrição</th><th>Regras</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>` : emptyState('🏷️', 'Nenhum cupom cadastrado')}
    </div>`;
}

function bindConfigEvents(container) {
  container.querySelector('#publishMenuBtn')?.addEventListener('click', () => {
    const config = getConfig();
    const settings = getSettings();
    const payload = buildPublicMenu(config, settings);
    savePublicMenuSnapshot(payload);

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'cardapio_publico.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);

    toast('Cardápio público atualizado e exportado!', 'success');
    renderConfigPage(container);
  });

  container.querySelector('#formCategory')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const config = getConfig();
    config.categories.push({
      id: uid(), name: fd.get('name').trim(),
      priceP: parseMoney(fd.get('priceP')), priceM: parseMoney(fd.get('priceM')), priceG: parseMoney(fd.get('priceG')),
    });
    saveConfig(config);
    toast('Categoria adicionada!', 'success');
    renderConfigPage(container);
  });

  container.querySelector('#formFlavor')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const config = getConfig();
    config.flavors.push({
      id: uid(),
      name: fd.get('name').trim(),
      categoryId: fd.get('categoryId'),
      imageUrl: fd.get('imageUrl').toString().trim(),
      extraImages: parseExtraImages(fd.get('extraImages')),
      ingredients: parseIngredients(fd.get('ingredients')),
    });
    saveConfig(config);
    toast('Sabor adicionado!', 'success');
    renderConfigPage(container);
  });

  container.querySelector('#formDrink')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const config = getConfig();
    config.drinks.push({
      id: uid(), name: fd.get('name').trim(),
      priceLata: parseMoney(fd.get('priceLata')), price1L: parseMoney(fd.get('price1L')), imageUrl: fd.get('imageUrl').toString().trim(),
    });
    saveConfig(config);
    toast('Bebida adicionada!', 'success');
    renderConfigPage(container);
  });

  container.querySelector('#formNeighborhood')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const config = getConfig();
    config.neighborhoods.push({ id: uid(), name: fd.get('name').trim(), fee: parseMoney(fd.get('fee')) });
    saveConfig(config);
    toast('Bairro adicionado!', 'success');
    renderConfigPage(container);
  });

  container.querySelector('#formMotoboy')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const config = getConfig();
    config.motoboys.push({ id: uid(), name: fd.get('name').trim(), active: true });
    saveConfig(config);
    toast('Motoboy adicionado!', 'success');
    renderConfigPage(container);
  });

  container.querySelector('#formChannel')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const config = getConfig();
    config.channels.push({ id: uid(), name: fd.get('name').trim() });
    saveConfig(config);
    toast('Canal adicionado!', 'success');
    renderConfigPage(container);
  });

  container.querySelector('#formAdditional')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const config = getConfig();
    config.additionals = config.additionals || [];
    config.additionals.push({ id: uid(), name: fd.get('name').trim(), price: parseMoney(fd.get('price')) });
    saveConfig(config);
    toast('Adicional adicionado!', 'success');
    renderConfigPage(container);
  });

  container.querySelector('#formCoupon')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const config = getConfig();
    config.coupons = config.coupons || [];
    config.coupons.push({
      id: uid(),
      code: fd.get('code').trim(),
      description: fd.get('description').trim(),
      type: fd.get('type'),
      value: parseMoney(fd.get('value')),
      minOrderValue: parseMoney(fd.get('minOrderValue')),
      productIds: parseIngredients(fd.get('productIds')),
      expiresAt: fd.get('expiresAt') ? new Date(fd.get('expiresAt')).toISOString() : '',
      active: !!fd.get('active'),
      freeShipping: !!fd.get('freeShipping'),
    });
    saveConfig(config);
    toast('Cupom adicionado!', 'success');
    renderConfigPage(container);
  });

  container.addEventListener('click', async (e) => {
    // Busca diretamente por elementos que tenham atributos de ação para ser mais robusto
    const btn = e.target.closest('[data-edit-cat],[data-edit-flavor],[data-edit-drink],[data-edit-neighborhood],[data-edit-motoboy],[data-edit-channel],[data-edit-additional],[data-edit-coupon],[data-delete-cat],[data-delete-flavor],[data-delete-drink],[data-delete-neighborhood],[data-delete-motoboy],[data-delete-channel],[data-delete-additional],[data-delete-coupon]');
    if (!btn) return;

    const config = getConfig();
    let changed = false;

    // ── Editar ──
    if (btn.dataset.editCat) {
      const item = config.categories.find((c) => c.id === btn.dataset.editCat);
      openFormModal({
        title: 'Editar Categoria',
        formHtml: `
          <div class="form-grid">
            <div class="form-group form-group--full"><label class="form-label">Nome</label>
              <input class="form-input" name="name" value="${escapeHtml(item.name)}" required></div>
            <div class="form-group"><label class="form-label">Preço P</label>
              <input class="form-input" name="priceP" type="number" step="0.01" value="${item.priceP}" required></div>
            <div class="form-group"><label class="form-label">Preço M</label>
              <input class="form-input" name="priceM" type="number" step="0.01" value="${item.priceM}" required></div>
            <div class="form-group"><label class="form-label">Preço G</label>
              <input class="form-input" name="priceG" type="number" step="0.01" value="${item.priceG}" required></div>
          </div>`,
        onSubmit: (_, fd) => {
          item.name = fd.get('name').trim();
          item.priceP = parseMoney(fd.get('priceP'));
          item.priceM = parseMoney(fd.get('priceM'));
          item.priceG = parseMoney(fd.get('priceG'));
          saveConfig(config);
          toast('Categoria atualizada!', 'success');
          renderConfigPage(container);
        },
      });
      return;
    }

    if (btn.dataset.editFlavor) {
      const item = config.flavors.find((f) => f.id === btn.dataset.editFlavor);
      const catOptions = config.categories.map((c) =>
        `<option value="${c.id}" ${c.id === item.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
      openFormModal({
        title: 'Editar Sabor',
        formHtml: `
          <div class="form-grid">
            <div class="form-group"><label class="form-label">Nome</label>
              <input class="form-input" name="name" value="${escapeHtml(item.name)}" required></div>
            <div class="form-group"><label class="form-label">Categoria</label>
              <select class="form-select" name="categoryId" required>${catOptions}</select></div>
            <div class="form-group form-group--full"><label class="form-label">Ingredientes (separados por vírgula)</label>
              <input class="form-input" name="ingredients" value="${escapeHtml((item.ingredients || []).join(', '))}" placeholder="mussarela, frango, milho"></div>
            <div class="form-group form-group--full"><label class="form-label">Link da Imagem</label>
              <input class="form-input" name="imageUrl" value="${escapeHtml(item.imageUrl || '')}" placeholder="https://... ou /assets/..."></div>
          </div>`,
        onSubmit: (_, fd) => {
          item.name = fd.get('name').trim();
          item.categoryId = fd.get('categoryId');
          item.imageUrl = fd.get('imageUrl').toString().trim();
          item.extraImages = parseExtraImages(fd.get('extraImages'));
          item.ingredients = parseIngredients(fd.get('ingredients'));
          saveConfig(config);
          toast('Sabor atualizado!', 'success');
          renderConfigPage(container);
        },
      });
      return;
    }

    if (btn.dataset.editDrink) {
      const item = config.drinks.find((d) => d.id === btn.dataset.editDrink);
      openFormModal({
        title: 'Editar Bebida',
        formHtml: `
          <div class="form-grid">
            <div class="form-group form-group--full"><label class="form-label">Nome</label>
              <input class="form-input" name="name" value="${escapeHtml(item.name)}" required></div>
            <div class="form-group"><label class="form-label">Preço Lata</label>
              <input class="form-input" name="priceLata" type="number" step="0.01" value="${item.priceLata}" required></div>
            <div class="form-group"><label class="form-label">Preço 1 Litro</label>
              <input class="form-input" name="price1L" type="number" step="0.01" value="${item.price1L}" required></div>
            <div class="form-group form-group--full"><label class="form-label">Link da Imagem</label>
              <input class="form-input" name="imageUrl" value="${escapeHtml(item.imageUrl || '')}" placeholder="https://... ou /assets/..."></div>
          </div>`,
        onSubmit: (_, fd) => {
          item.name = fd.get('name').trim();
          item.priceLata = parseMoney(fd.get('priceLata'));
          item.price1L = parseMoney(fd.get('price1L'));
          item.imageUrl = fd.get('imageUrl').toString().trim();
          saveConfig(config);
          toast('Bebida atualizada!', 'success');
          renderConfigPage(container);
        },
      });
      return;
    }

    if (btn.dataset.editNeighborhood) {
      const item = config.neighborhoods.find((n) => n.id === btn.dataset.editNeighborhood);
      openFormModal({
        title: 'Editar Bairro',
        formHtml: `
          <div class="form-grid">
            <div class="form-group"><label class="form-label">Bairro</label>
              <input class="form-input" name="name" value="${escapeHtml(item.name)}" required></div>
            <div class="form-group"><label class="form-label">Taxa (R$)</label>
              <input class="form-input" name="fee" type="number" step="0.01" value="${item.fee}" required></div>
          </div>`,
        onSubmit: (_, fd) => {
          item.name = fd.get('name').trim();
          item.fee = parseMoney(fd.get('fee'));
          saveConfig(config);
          toast('Bairro atualizado!', 'success');
          renderConfigPage(container);
        },
      });
      return;
    }

    if (btn.dataset.editMotoboy) {
      const item = config.motoboys.find((m) => m.id === btn.dataset.editMotoboy);
      openFormModal({
        title: 'Editar Motoboy',
        formHtml: `
          <div class="form-grid">
            <div class="form-group form-group--full"><label class="form-label">Nome</label>
              <input class="form-input" name="name" value="${escapeHtml(item.name)}" required></div>
            <div class="form-group form-group--full">
              <label class="form-label checkbox-label">
                <input type="checkbox" name="active" value="1" ${item.active ? 'checked' : ''}> Motoboy ativo
              </label>
            </div>
          </div>`,
        onSubmit: (form, fd) => {
          item.name = fd.get('name').trim();
          item.active = form.querySelector('[name="active"]').checked;
          saveConfig(config);
          toast('Motoboy atualizado!', 'success');
          renderConfigPage(container);
        },
      });
      return;
    }

    if (btn.dataset.editChannel) {
      const item = config.channels.find((c) => c.id === btn.dataset.editChannel);
      openFormModal({
        title: 'Editar Canal',
        formHtml: `
          <div class="form-group"><label class="form-label">Canal</label>
            <input class="form-input" name="name" value="${escapeHtml(item.name)}" required></div>`,
        onSubmit: (_, fd) => {
          item.name = fd.get('name').trim();
          saveConfig(config);
          toast('Canal atualizado!', 'success');
          renderConfigPage(container);
        },
      });
      return;
    }

    if (btn.dataset.editAdditional) {
      const item = (config.additionals || []).find((a) => a.id === btn.dataset.editAdditional);
      openFormModal({
        title: 'Editar Adicional',
        formHtml: `
          <div class="form-grid">
            <div class="form-group"><label class="form-label">Nome</label>
              <input class="form-input" name="name" value="${escapeHtml(item.name)}" required></div>
            <div class="form-group"><label class="form-label">Preço</label>
              <input class="form-input" name="price" type="number" step="0.01" value="${item.price}" required></div>
          </div>`,
        onSubmit: (_, fd) => {
          item.name = fd.get('name').trim();
          item.price = parseMoney(fd.get('price'));
          saveConfig(config);
          toast('Adicional atualizado!', 'success');
          renderConfigPage(container);
        },
      });
      return;
    }

    const editCouponIdAttr = btn.dataset.editCoupon || btn.getAttribute && btn.getAttribute('data-edit-coupon');
    if (editCouponIdAttr) {
      const item = (config.coupons || []).find((coupon) => coupon.id === editCouponIdAttr);
      openFormModal({
        title: 'Editar Cupom',
        formHtml: `
          <div class="form-grid">
            <div class="form-group form-group--full"><label class="form-label">Código</label>
              <input class="form-input" name="code" value="${escapeHtml(item.code)}" required></div>
            <div class="form-group form-group--full"><label class="form-label">Descrição</label>
              <input class="form-input" name="description" value="${escapeHtml(item.description || '')}"></div>
            <div class="form-group"><label class="form-label">Tipo</label>
              <select class="form-select" name="type">
                <option value="" ${item.type === '' ? 'selected' : ''}>Sem desconto</option>
                <option value="percent" ${item.type === 'percent' ? 'selected' : ''}>Porcentagem</option>
                <option value="fixed" ${item.type === 'fixed' ? 'selected' : ''}>Valor fixo</option>
              </select></div>
            <div class="form-group"><label class="form-label">Valor</label>
              <input class="form-input" name="value" type="number" step="0.01" min="0" value="${item.value || ''}"></div>
            <div class="form-group"><label class="form-label">Valor mínimo do pedido</label>
              <input class="form-input" name="minOrderValue" type="number" step="0.01" min="0" value="${item.minOrderValue || ''}"></div>
            <div class="form-group form-group--full"><label class="form-label">Produtos específicos</label>
              <input class="form-input" name="productIds" value="${escapeHtml((item.productIds || []).join(', '))}" placeholder="IDs separados por vírgula"></div>
            <div class="form-group"><label class="form-label">Validade</label>
              <input class="form-input" name="expiresAt" type="date" value="${item.expiresAt ? item.expiresAt.split('T')[0] : ''}"></div>
            <div class="form-group form-group--full">
              <label class="form-label checkbox-label">
                <input type="checkbox" name="active" value="1" ${item.active ? 'checked' : ''}> Cupom ativo
              </label>
            </div>
            <div class="form-group form-group--full">
              <label class="form-label checkbox-label">
                <input type="checkbox" name="freeShipping" value="1" ${item.freeShipping ? 'checked' : ''}> Frete grátis
              </label>
            </div>
          </div>`,
        onSubmit: (_, fd) => {
          item.code = fd.get('code').trim();
          item.description = fd.get('description').trim();
          item.type = fd.get('type');
          item.value = parseMoney(fd.get('value'));
          item.minOrderValue = parseMoney(fd.get('minOrderValue'));
          item.productIds = parseIngredients(fd.get('productIds'));
          item.expiresAt = fd.get('expiresAt') ? new Date(fd.get('expiresAt')).toISOString() : '';
          item.active = !!fd.get('active');
          item.freeShipping = !!fd.get('freeShipping');
          saveConfig(config);
          toast('Cupom atualizado!', 'success');
          renderConfigPage(container);
        },
      });
      return;
    }

    // ── Excluir ──
    if (btn.dataset.deleteCat && await confirmModal({ title: 'Excluir Categoria', message: 'Sabores vinculados perderão a referência. Continuar?', danger: true })) {
      config.categories = config.categories.filter((c) => c.id !== btn.dataset.deleteCat);
      changed = true;
    }
    if (btn.dataset.deleteFlavor && await confirmModal({ title: 'Excluir Sabor', message: 'Confirma a exclusão?', danger: true })) {
      config.flavors = config.flavors.filter((f) => f.id !== btn.dataset.deleteFlavor);
      changed = true;
    }
    if (btn.dataset.deleteDrink && await confirmModal({ title: 'Excluir Bebida', message: 'Confirma a exclusão?', danger: true })) {
      config.drinks = config.drinks.filter((d) => d.id !== btn.dataset.deleteDrink);
      changed = true;
    }
    if (btn.dataset.deleteNeighborhood && await confirmModal({ title: 'Excluir Bairro', message: 'Confirma a exclusão?', danger: true })) {
      config.neighborhoods = config.neighborhoods.filter((n) => n.id !== btn.dataset.deleteNeighborhood);
      changed = true;
    }
    if (btn.dataset.deleteMotoboy && await confirmModal({ title: 'Excluir Motoboy', message: 'Confirma a exclusão?', danger: true })) {
      config.motoboys = config.motoboys.filter((m) => m.id !== btn.dataset.deleteMotoboy);
      changed = true;
    }
    if (btn.dataset.deleteChannel && await confirmModal({ title: 'Excluir Canal', message: 'Confirma a exclusão?', danger: true })) {
      config.channels = config.channels.filter((c) => c.id !== btn.dataset.deleteChannel);
      changed = true;
    }
    if (btn.dataset.deleteAdditional && await confirmModal({ title: 'Excluir Adicional', message: 'Confirma a exclusão?', danger: true })) {
      config.additionals = (config.additionals || []).filter((a) => a.id !== btn.dataset.deleteAdditional);
      changed = true;
    }
    const deleteCouponIdAttr = btn.dataset.deleteCoupon || btn.getAttribute && btn.getAttribute('data-delete-coupon');
    if (deleteCouponIdAttr && await confirmModal({ title: 'Excluir Cupom', message: 'Confirma a exclusão?', danger: true })) {
      config.coupons = (config.coupons || []).filter((coupon) => coupon.id !== deleteCouponIdAttr);
      changed = true;
    }

    if (changed) {
      saveConfig(config);
      toast('Item excluído.', 'info');
      renderConfigPage(container);
    }
  });
}

