/**
 * PROVOLETA — Módulo de Cadastros e Configurações
 * CRUD completo: criar, editar e excluir.
 */

import { getConfig, saveConfig, getPublicMenuSnapshot, savePublicMenuSnapshot, getSettings } from '../storage.js';
import { buildPublicMenu } from '../public-menu.js';
import { uid, escapeHtml, parseMoney } from '../utils.js';
import { toast, confirmModal, initTabs, emptyState, tableActions, openFormModal } from '../ui.js';

let activeTab = 'categorias';

export function renderConfigPage(container) {
  const config = getConfig();
  const publicMenu = getPublicMenuSnapshot();
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
      <p class="form-hint">Cada alteração salva aqui atualiza o payload local do cardápio público para exportação e publicação.</p>
      <button type="button" class="btn btn--primary" id="publishMenuBtn">Salvar e Atualizar Cardápio Público</button>
    </div>

    <div class="tabs" id="configTabs">
      <button class="tab-btn ${activeTab === 'categorias' ? 'active' : ''}" data-tab="categorias">Categorias</button>
      <button class="tab-btn ${activeTab === 'sabores' ? 'active' : ''}" data-tab="sabores">Sabores</button>
      <button class="tab-btn ${activeTab === 'bebidas' ? 'active' : ''}" data-tab="bebidas">Bebidas</button>
      <button class="tab-btn ${activeTab === 'logistica' ? 'active' : ''}" data-tab="logistica">Logística</button>
      <button class="tab-btn ${activeTab === 'equipe' ? 'active' : ''}" data-tab="equipe">Equipe e Canais</button>
    </div>

    <div class="tab-panel ${activeTab === 'categorias' ? 'active' : ''}" data-panel="categorias">${renderCategoriesPanel(config)}</div>
    <div class="tab-panel ${activeTab === 'sabores' ? 'active' : ''}" data-panel="sabores">${renderFlavorsPanel(config)}</div>
    <div class="tab-panel ${activeTab === 'bebidas' ? 'active' : ''}" data-panel="bebidas">${renderDrinksPanel(config)}</div>
    <div class="tab-panel ${activeTab === 'logistica' ? 'active' : ''}" data-panel="logistica">${renderLogisticsPanel(config)}</div>
    <div class="tab-panel ${activeTab === 'equipe' ? 'active' : ''}" data-panel="equipe">${renderTeamPanel(config)}</div>
  `;

  initTabs(container);
  container.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => { activeTab = btn.dataset.tab; });
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
    return `<tr>
      <td><strong>${escapeHtml(f.name)}</strong></td>
      <td>${cat ? escapeHtml(cat.name) : '—'}</td>
      <td>${f.imageUrl ? '<span class="tag tag--ok">Com imagem</span>' : '<span class="tag tag--pending">Sem imagem</span>'}</td>
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
          <input class="form-input" name="name" required placeholder="Ex: Carlos"></div>
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
    config.flavors.push({ id: uid(), name: fd.get('name').trim(), categoryId: fd.get('categoryId'), imageUrl: fd.get('imageUrl').toString().trim() });
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

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
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
            <div class="form-group form-group--full"><label class="form-label">Link da Imagem</label>
              <input class="form-input" name="imageUrl" value="${escapeHtml(item.imageUrl || '')}" placeholder="https://... ou /assets/..."></div>
          </div>`,
        onSubmit: (_, fd) => {
          item.name = fd.get('name').trim();
          item.categoryId = fd.get('categoryId');
          item.imageUrl = fd.get('imageUrl').toString().trim();
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

    if (changed) {
      saveConfig(config);
      toast('Item excluído.', 'info');
      renderConfigPage(container);
    }
  });
}
