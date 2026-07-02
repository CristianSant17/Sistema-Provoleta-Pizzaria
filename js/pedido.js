/**
 * PROVOLETA — Página pública de pedidos (pedido.html)
 * Layout inspirado em apps de delivery (cardápio + sacola lateral).
 */

import { formatMoney, escapeHtml, normalizeWhatsApp, whatsappUrl } from './utils.js';
import { normalizePublicMenu } from './public-menu.js';
import { PUBLIC_MENU_FILE, DEFAULT_WHATSAPP_NUMBER } from './constants.js';

let menu = null;
let cart = [];
let deliveryFee = 0;
let menuTab = 'pizza';
let selectedFlavorId = null;
let selectedDrinkId = null;
let selectedSize = null;
let highlightIndex = 0;
let highlightTimer = null;
let customizationModal = null;
let customizationState = null;

async function loadMenu() {
  try {
    const res = await fetch(`${PUBLIC_MENU_FILE}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('not found');
    return normalizePublicMenu(await res.json());
  } catch {
    return null;
  }
}

function showToast(msg, error = false) {
  const el = document.createElement('div');
  el.className = `pz-toast${error ? ' pz-toast--error' : ''}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function calcItemPrice(type, itemId, size) {
  if (type === 'pizza') {
    const flavor = menu.flavors.find((f) => f.id === itemId);
    const cat = menu.categories.find((c) => c.id === flavor?.categoryId);
    if (!cat) return 0;
    return size === 'P' ? cat.priceP : size === 'M' ? cat.priceM : cat.priceG;
  }
  const drink = menu.drinks.find((d) => d.id === itemId);
  return drink ? (size === 'Lata' ? drink.priceLata : drink.price1L) : 0;
}

function getFlavorPrices(flavorId) {
  const flavor = menu.flavors.find((f) => f.id === flavorId);
  const cat = menu.categories.find((c) => c.id === flavor?.categoryId);
  if (!cat) return null;
  return { P: cat.priceP, M: cat.priceM, G: cat.priceG, category: cat.name };
}

function sizeLabel(size) {
  return { P: 'Pequena', M: 'Média', G: 'Grande', Lata: 'Lata', '1L': '1 Litro' }[size] || size;
}

function paymentLabel(p) {
  return { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão' }[p] || p;
}

function cartSubtotal() {
  return cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
}

function cartTotal() {
  return cartSubtotal() + (cart.length ? deliveryFee : 0);
}

function cartCount() {
  return cart.reduce((s, i) => s + i.quantity, 0);
}

function renderCart() {
  const list = document.getElementById('cartList');
  const summary = document.getElementById('cartSummary');
  const btn = document.getElementById('whatsappBtn');
  const btnMobile = document.getElementById('whatsappBtnMobile');
  const footerTotal = document.getElementById('footerTotal');
  const sidebarTotal = document.getElementById('sidebarTotal');
  const badge = document.getElementById('cartBadge');
  const floatingCart = document.getElementById('floatingCart');
  const drawerList = document.getElementById('cartDrawerList');
  const drawerSummary = document.getElementById('cartDrawerSummary');
  const drawerTotal = document.getElementById('cartDrawerTotal');
  const floatingCartLabel = document.getElementById('floatingCartLabel');
  const floatingCartTotal = document.getElementById('floatingCartTotal');

  const count = cartCount();
  if (badge) {
    badge.textContent = count;
    badge.hidden = count === 0;
  }

  if (!cart.length) {
    list.innerHTML = `
      <div class="pz-cart-empty">
        <div class="pz-cart-empty__icon">🛒</div>
        <p>Sua sacola está vazia</p>
        <span>Escolha pizzas e bebidas ao lado</span>
      </div>`;
    summary.innerHTML = '';
    if (btn) btn.disabled = true;
    if (btnMobile) btnMobile.disabled = true;
    const zero = formatMoney(0);
    if (footerTotal) footerTotal.textContent = zero;
    if (sidebarTotal) sidebarTotal.textContent = zero;
    if (floatingCart) floatingCart.hidden = true;
    if (drawerList) drawerList.innerHTML = `
      <div class="pz-cart-empty">
        <div class="pz-cart-empty__icon">🛒</div>
        <p>Sua sacola está vazia</p>
        <span>Escolha pizzas e bebidas ao lado</span>
      </div>`;
    if (drawerSummary) drawerSummary.innerHTML = '';
    if (drawerTotal) drawerTotal.textContent = zero;
    return;
  }

  list.innerHTML = cart.map((item, idx) => {
    const additions = (item.additionals || []).map((a) => a.name).join(', ');
    const details = [sizeLabel(item.size), additions ? `+ ${additions}` : ''].filter(Boolean).join(' · ');
    return `
      <article class="pz-cart-item">
        <div class="pz-cart-item__icon">${item.type === 'pizza' ? '🍕' : '🥤'}</div>
        <div class="pz-cart-item__body">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${item.quantity}x · ${details}</span>
        </div>
        <div class="pz-cart-item__right">
          <span class="pz-cart-item__price">${formatMoney(item.unitPrice * item.quantity)}</span>
          <button type="button" class="pz-cart-item__remove" data-remove="${idx}" aria-label="Remover">Remover</button>
        </div>
      </article>`;
  }).join('');

  summary.innerHTML = `
    <div class="pz-summary-row"><span>Subtotal</span><span>${formatMoney(cartSubtotal())}</span></div>
    <div class="pz-summary-row"><span>Taxa de entrega</span><span>${formatMoney(deliveryFee)}</span></div>
    <div class="pz-summary-row pz-summary-row--total"><span>Total</span><span>${formatMoney(cartTotal())}</span></div>`;

  const total = formatMoney(cartTotal());
  if (btn) btn.disabled = false;
  if (btnMobile) btnMobile.disabled = false;
  if (footerTotal) footerTotal.textContent = total;
  if (sidebarTotal) sidebarTotal.textContent = total;
  if (floatingCart) {
    floatingCart.hidden = false;
    if (floatingCartLabel) floatingCartLabel.textContent = `Ver Sacola (${count} itens)`;
    if (floatingCartTotal) floatingCartTotal.textContent = total;
  }

  if (drawerList) {
    drawerList.innerHTML = cart.map((item, idx) => {
      const additions = (item.additionals || []).map((a) => a.name).join(', ');
      const details = [sizeLabel(item.size), additions ? `+ ${additions}` : ''].filter(Boolean).join(' · ');
      return `
        <article class="pz-cart-item pz-cart-item--drawer">
          <div class="pz-cart-item__icon">${item.type === 'pizza' ? '🍕' : '🥤'}</div>
          <div class="pz-cart-item__body">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${item.quantity}x · ${details}</span>
          </div>
          <div class="pz-cart-item__right">
            <span class="pz-cart-item__price">${formatMoney(item.unitPrice * item.quantity)}</span>
            <button type="button" class="pz-cart-item__remove" data-remove="${idx}" aria-label="Remover">Remover</button>
          </div>
        </article>`;
    }).join('');
  }

  if (drawerSummary) {
    drawerSummary.innerHTML = `
      <div class="pz-summary-row"><span>Subtotal</span><span>${formatMoney(cartSubtotal())}</span></div>
      <div class="pz-summary-row"><span>Taxa de entrega</span><span>${formatMoney(deliveryFee)}</span></div>
      <div class="pz-summary-row pz-summary-row--total"><span>Total</span><span>${formatMoney(cartTotal())}</span></div>`;
  }

  if (drawerTotal) drawerTotal.textContent = total;
}

function renderCustomizationModal() {
  if (!customizationModal || !customizationState) return;

  const { item, size, quantity, basePrice, selectedAdditionals } = customizationState;
  const total = (basePrice + selectedAdditionals.reduce((s, a) => s + (a.price || 0), 0)) * quantity;
  const additionals = (menu?.additionals || []).map((extra) => {
    const checked = selectedAdditionals.some((a) => a.id === extra.id);
    return `
      <div class="pz-additional-item">
        <label>
          <input type="checkbox" data-additional-id="${extra.id}" ${checked ? 'checked' : ''}>
          <span>${escapeHtml(extra.name)}</span>
        </label>
        <span>${formatMoney(extra.price || 0)}</span>
      </div>`;
  }).join('');

  customizationModal.innerHTML = `
    <div class="pz-modal-backdrop">
      <div class="pz-modal" role="dialog" aria-modal="true">
        <div class="pz-modal__image">
          ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.name)}">` : '<div class="pz-product-card__image--fallback">🍕</div>'}
        </div>
        <div class="pz-modal__body">
          <h3 class="pz-modal__title">${escapeHtml(item.name)}</h3>
          <p class="pz-modal__subtitle">${escapeHtml(sizeLabel(size))} · ${quantity} unidade${quantity > 1 ? 's' : ''}</p>
          <div class="pz-modal__section">
            <h4>Adicionar extras</h4>
            ${additionals || '<p class="pz-builder-hint">Nenhum extra cadastrado.</p>'}
          </div>
        </div>
        <div class="pz-modal__footer">
          <div class="pz-modal__total">Total: ${formatMoney(total)}</div>
          <div class="pz-builder-footer">
            <button type="button" class="pz-btn-add-cart" data-action="cancel" style="background: #44403c; box-shadow: none; min-width: 120px;">Cancelar</button>
            <button type="button" class="pz-btn-add-cart" data-action="confirm" style="min-width: 140px;">Confirmar</button>
          </div>
        </div>
      </div>
    </div>`;

  customizationModal.querySelectorAll('input[data-additional-id]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const id = event.target.getAttribute('data-additional-id');
      const extra = (menu?.additionals || []).find((itemExtra) => itemExtra.id === id);
      if (!extra) return;
      if (event.target.checked) {
        customizationState.selectedAdditionals = [...customizationState.selectedAdditionals, extra];
      } else {
        customizationState.selectedAdditionals = customizationState.selectedAdditionals.filter((selected) => selected.id !== id);
      }
      renderCustomizationModal();
    });
  });

  customizationModal.querySelector('[data-action="cancel"]')?.addEventListener('click', closeCustomizationModal);
  customizationModal.querySelector('[data-action="confirm"]')?.addEventListener('click', confirmCustomization);
}

function closeCustomizationModal() {
  if (customizationModal) {
    customizationModal.innerHTML = '';
  }
  customizationState = null;
}

function confirmCustomization() {
  if (!customizationState) return;
  const { type, item, size, quantity, basePrice, selectedAdditionals } = customizationState;
  const unitPrice = basePrice + selectedAdditionals.reduce((sum, extra) => sum + (extra.price || 0), 0);
  cart.push({
    type,
    name: item.name,
    size,
    quantity,
    unitPrice,
    additionals: selectedAdditionals,
  });
  renderCart();
  showToast(`${item.name} adicionada!`);
  closeCustomizationModal();
  selectedSize = null;
  if (type === 'pizza') {
    renderPizzaBuilder();
    document.querySelectorAll('.pz-product-card--pizza').forEach((card) => {
      card.classList.toggle('selected', card.dataset.flavorId === selectedFlavorId);
    });
  } else {
    renderDrinkBuilder();
  }
}

function openCustomizationModal(config) {
  customizationState = {
    type: config.type,
    item: config.item,
    size: config.size,
    quantity: config.quantity,
    basePrice: config.basePrice,
    selectedAdditionals: [],
  };
  if (!customizationModal) {
    customizationModal = document.createElement('div');
    customizationModal.id = 'customizationModal';
    document.body.appendChild(customizationModal);
  }
  renderCustomizationModal();
}

function renderPizzaBuilder() {
  const el = document.getElementById('pizzaBuilder');
  if (!el) return;

  if (!selectedFlavorId) {
    el.innerHTML = '<p class="pz-builder-hint">Toque em um sabor para escolher o tamanho</p>';
    return;
  }

  const flavor = menu.flavors.find((f) => f.id === selectedFlavorId);
  const prices = getFlavorPrices(selectedFlavorId);
  if (!flavor || !prices) return;

  el.innerHTML = `
    <div class="pz-builder-head">
      <strong>${escapeHtml(flavor.name)}</strong>
      <span class="pz-builder-cat">${escapeHtml(prices.category)}</span>
    </div>
    <p class="pz-builder-label">Escolha o tamanho</p>
    <div class="pz-size-grid">
      ${['P', 'M', 'G'].map((s) => `
        <button type="button" class="pz-size-btn ${selectedSize === s ? 'active' : ''}" data-size="${s}">
          <span class="pz-size-btn__label">${s === 'P' ? 'Pequena' : s === 'M' ? 'Média' : 'Grande'}</span>
          <span class="pz-size-btn__price">${formatMoney(prices[s])}</span>
        </button>`).join('')}
    </div>
    <div class="pz-builder-footer">
      <div class="pz-qty">
        <button type="button" class="pz-qty__btn" id="pizzaQtyMinus">−</button>
        <span id="pizzaQtyVal">1</span>
        <button type="button" class="pz-qty__btn" id="pizzaQtyPlus">+</button>
      </div>
      <button type="button" class="pz-btn-add-cart" id="addPizza" ${!selectedSize ? 'disabled' : ''}>
        Adicionar · ${selectedSize ? formatMoney(calcItemPrice('pizza', selectedFlavorId, selectedSize)) : '—'}
      </button>
    </div>`;

  el.querySelectorAll('.pz-size-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedSize = btn.dataset.size;
      renderPizzaBuilder();
    });
  });

  let qty = 1;
  const qtyVal = el.querySelector('#pizzaQtyVal');
  el.querySelector('#pizzaQtyMinus')?.addEventListener('click', () => {
    qty = Math.max(1, qty - 1);
    if (qtyVal) qtyVal.textContent = qty;
  });
  el.querySelector('#pizzaQtyPlus')?.addEventListener('click', () => {
    qty += 1;
    if (qtyVal) qtyVal.textContent = qty;
  });

  el.querySelector('#addPizza')?.addEventListener('click', () => {
    if (!selectedSize) { showToast('Escolha o tamanho.', true); return; }
    openCustomizationModal({
      type: 'pizza',
      item: flavor,
      size: selectedSize,
      quantity: qty,
      basePrice: calcItemPrice('pizza', selectedFlavorId, selectedSize),
    });
  });
}

function renderDrinkBuilder() {
  const el = document.getElementById('drinkBuilder');
  if (!el) return;

  if (!selectedDrinkId) {
    el.innerHTML = '<p class="pz-builder-hint">Toque em uma bebida para escolher o tamanho</p>';
    return;
  }

  const drink = menu.drinks.find((d) => d.id === selectedDrinkId);
  if (!drink) return;

  el.innerHTML = `
    <div class="pz-builder-head"><strong>${escapeHtml(drink.name)}</strong></div>
    <p class="pz-builder-label">Escolha o tamanho</p>
    <div class="pz-size-grid pz-size-grid--2">
      ${['Lata', '1L'].map((s) => `
        <button type="button" class="pz-size-btn ${selectedSize === s ? 'active' : ''}" data-size="${s}">
          <span class="pz-size-btn__label">${sizeLabel(s)}</span>
          <span class="pz-size-btn__price">${formatMoney(s === 'Lata' ? drink.priceLata : drink.price1L)}</span>
        </button>`).join('')}
    </div>
    <div class="pz-builder-footer">
      <div class="pz-qty">
        <button type="button" class="pz-qty__btn" id="drinkQtyMinus">−</button>
        <span id="drinkQtyVal">1</span>
        <button type="button" class="pz-qty__btn" id="drinkQtyPlus">+</button>
      </div>
      <button type="button" class="pz-btn-add-cart" id="addDrink" ${!selectedSize ? 'disabled' : ''}>
        Adicionar · ${selectedSize ? formatMoney(calcItemPrice('bebida', selectedDrinkId, selectedSize)) : '—'}
      </button>
    </div>`;

  el.querySelectorAll('.pz-size-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedSize = btn.dataset.size;
      renderDrinkBuilder();
    });
  });

  let qty = 1;
  const qtyVal = el.querySelector('#drinkQtyVal');
  el.querySelector('#drinkQtyMinus')?.addEventListener('click', () => {
    qty = Math.max(1, qty - 1);
    if (qtyVal) qtyVal.textContent = qty;
  });
  el.querySelector('#drinkQtyPlus')?.addEventListener('click', () => {
    qty += 1;
    if (qtyVal) qtyVal.textContent = qty;
  });

  el.querySelector('#addDrink')?.addEventListener('click', () => {
    if (!selectedSize) { showToast('Escolha o tamanho.', true); return; }
    openCustomizationModal({
      type: 'bebida',
      item: drink,
      size: selectedSize,
      quantity: qty,
      basePrice: calcItemPrice('bebida', selectedDrinkId, selectedSize),
    });
  });
}

function renderFlavorGrid() {
  return menu.flavors.map((f) => {
    const cat = menu.categories.find((c) => c.id === f.categoryId);
    const from = cat ? formatMoney(Math.min(cat.priceP, cat.priceM, cat.priceG)) : '';
    const image = f.imageUrl ? `<div class="pz-product-card__image"><img src="${f.imageUrl}" alt="${escapeHtml(f.name)}" loading="lazy"></div>` : `<div class="pz-product-card__image pz-product-card__image--fallback">🍕</div>`;
    return `
      <button type="button" class="pz-product-card pz-product-card--pizza ${selectedFlavorId === f.id ? 'selected' : ''}"
              data-flavor-id="${f.id}">
        ${image}
        <span class="pz-product-card__name">${escapeHtml(f.name)}</span>
        ${cat ? `<span class="pz-product-card__meta">${escapeHtml(cat.name)} · a partir de ${from}</span>` : ''}
      </button>`;
  }).join('');
}

function renderDrinkGrid() {
  return menu.drinks.map((d) => {
    const image = d.imageUrl ? `<div class="pz-product-card__image"><img src="${d.imageUrl}" alt="${escapeHtml(d.name)}" loading="lazy"></div>` : `<div class="pz-product-card__image pz-product-card__image--fallback">🥤</div>`;
    return `
      <button type="button" class="pz-product-card pz-product-card--drink ${selectedDrinkId === d.id ? 'selected' : ''}"
              data-drink-id="${d.id}">
        ${image}
        <span class="pz-product-card__name">${escapeHtml(d.name)}</span>
        <span class="pz-product-card__meta">Lata ${formatMoney(d.priceLata)} · 1L ${formatMoney(d.price1L)}</span>
      </button>`;
  }).join('');
}

function switchMenuTab(tab) {
  menuTab = tab;
  selectedSize = null;
  document.querySelectorAll('.pz-segment__btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.getElementById('panelPizza').hidden = tab !== 'pizza';
  document.getElementById('panelDrink').hidden = tab !== 'bebida';
}

function buildHighlightsMarkup() {
  const featured = [
    ...(menu.flavors || []).slice(0, 2),
    ...(menu.drinks || []).slice(0, 1),
  ].filter(Boolean);
  if (!featured.length) return '';
  return `
    <section class="pz-highlights">
      <div class="pz-highlight-slider">
        <div class="pz-highlight-track" id="highlightTrack" style="transform: translateX(-${highlightIndex * 100}%);">
          ${featured.map((item) => `
            <article class="pz-highlight-card">
              <div class="pz-highlight-card__image">
                ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.name)}" loading="lazy">` : '<div class="pz-product-card__image--fallback">🍕</div>'}
              </div>
              <div class="pz-highlight-card__content">
                <h3>${escapeHtml(item.name)}</h3>
                <p>${item.categoryId ? 'Uma das opções mais pedidas da semana.' : 'Refrescante e ideal para acompanhar seu pedido.'}</p>
                <button type="button" class="pz-btn-add-cart" style="min-width: auto; padding: 0.7rem 1rem;">Escolher agora</button>
              </div>
            </article>`).join('')}
        </div>
      </div>
      <div class="pz-highlight-dots">
        ${featured.map((_, index) => `<button type="button" class="pz-highlight-dot ${index === highlightIndex ? 'active' : ''}" data-slide="${index}" aria-label="Ir para destaque ${index + 1}"></button>`).join('')}
      </div>
    </section>`;
}

function updateHighlightSlider() {
  const track = document.getElementById('highlightTrack');
  if (track) track.style.transform = `translateX(-${highlightIndex * 100}%)`;
  document.querySelectorAll('.pz-highlight-dot').forEach((dot) => {
    dot.classList.toggle('active', Number(dot.dataset.slide) === highlightIndex);
  });
}

function initHighlights() {
  if (highlightTimer) clearInterval(highlightTimer);
  if (!document.querySelector('.pz-highlight-dot')) return;
  highlightTimer = setInterval(() => {
    highlightIndex = (highlightIndex + 1) % Math.max(1, document.querySelectorAll('.pz-highlight-dot').length);
    updateHighlightSlider();
  }, 5000);
}

function buildWhatsAppMessage() {
  const { store } = menu;
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const address = document.getElementById('customerAddress').value.trim();
  const neighborhood = document.getElementById('neighborhood').selectedOptions[0]?.text || '';
  const payment = document.getElementById('payment').value;
  const obs = document.getElementById('observations').value.trim();

  const lines = [
    ` *NOVO PEDIDO — ${store.name}*`, '',
    ` *Cliente:* ${name}`, ` *Telefone:* ${phone}`,
    ` *Bairro:* ${neighborhood}`, ` *Endereço:* ${address}`, '',
    '*ITENS:*',
  ];
  cart.forEach((item, i) => {
    const extras = (item.additionals || []).map((a) => a.name).join(', ');
    const details = extras ? ` · extras: ${extras}` : '';
    lines.push(`${i + 1}. ${item.quantity}x ${item.name} (${sizeLabel(item.size)})${details} — ${formatMoney(item.unitPrice * item.quantity)}`);
  });
  lines.push('', ` *Taxa de entrega:* ${formatMoney(deliveryFee)}`, ` *TOTAL: ${formatMoney(cartTotal())}*`, '', ` *Pagamento:* ${paymentLabel(payment)}`);
  if (obs) lines.push(` *Obs:* ${obs}`);
  lines.push('', `_Pedido online · ${new Date().toLocaleString('pt-BR')}_`);
  return lines.join('\n');
}

function sendWhatsApp() {
  if (!document.getElementById('customerName').value.trim()) { showToast('Informe seu nome.', true); return; }
  if (!document.getElementById('customerPhone').value.trim()) { showToast('Informe seu telefone.', true); return; }
  if (!document.getElementById('neighborhood').value) { showToast('Selecione o bairro.', true); return; }
  if (!document.getElementById('customerAddress').value.trim()) { showToast('Informe o endereço.', true); return; }
  if (!document.getElementById('payment').value) { showToast('Selecione o pagamento.', true); return; }
  if (!cart.length) { showToast('Adicione itens ao pedido.', true); return; }
  const url = whatsappUrl(normalizeWhatsApp(menu.store.whatsapp) || DEFAULT_WHATSAPP_NUMBER, buildWhatsAppMessage());
  if (url) window.open(url, '_blank');
}

function renderUnavailable() {
  document.getElementById('app').innerHTML = `
    <div class="pz-unavailable">
      <div class="pz-unavailable__icon">🍕</div>
      <h1>Cardápio indisponível</h1>
      <p>Arquivo <code>${PUBLIC_MENU_FILE}</code> não encontrado.</p>
    </div>`;
}

function renderApp() {
  const { store } = menu;
  const hasPizza = menu.flavors.length > 0;
  const hasDrink = menu.drinks.length > 0;

  document.getElementById('app').innerHTML = `
    <header class="pz-topbar">
      <div class="pz-topbar__inner">
        <div class="pz-topbar__brand">
          <div class="pz-topbar__logo">
            <img src="assets/logo.png" alt="" onerror="this.parentElement.classList.add('is-fallback')">
          </div>
          <div>
            <h1>${escapeHtml(store.name)}</h1>
            ${store.openHours ? `<span class="pz-topbar__hours">${escapeHtml(store.openHours)}</span>` : ''}
          </div>
        </div>
        <div class="pz-topbar__badge">
          <span>Delivery</span>
          <span class="pz-cart-badge" id="cartBadge" hidden>0</span>
        </div>
      </div>
    </header>

    <section class="pz-banner">
      <div class="pz-banner__inner">
        <p class="pz-banner__eyebrow">Peça online · receba em casa</p>
        <h2>${escapeHtml(store.welcomeMessage)}</h2>
        <div class="pz-banner__pills">
          <span>🛵 Entrega rápida</span>
          <span>💬 Pedido via WhatsApp</span>
          <span>✓ Pagamento na entrega</span>
        </div>
      </div>
    </section>

    ${buildHighlightsMarkup()}

    <div class="pz-layout">
      <div class="pz-main-col">
        ${hasPizza || hasDrink ? `
        <section class="pz-section">
          <div class="pz-section__head">
            <h3>Cardápio</h3>
            <p>Escolha os itens e monte seu pedido</p>
          </div>

          <div class="pz-segment">
            ${hasPizza ? `<button type="button" class="pz-segment__btn ${menuTab === 'pizza' ? 'active' : ''}" data-tab="pizza">🍕 Pizzas</button>` : ''}
            ${hasDrink ? `<button type="button" class="pz-segment__btn ${menuTab === 'bebida' ? 'active' : ''}" data-tab="bebida">🥤 Bebidas</button>` : ''}
          </div>

          <div id="panelPizza" ${!hasPizza || menuTab !== 'pizza' ? 'hidden' : ''}>
            <div class="pz-product-grid">${renderFlavorGrid()}</div>
            <div class="pz-builder" id="pizzaBuilder"></div>
          </div>
          <div id="panelDrink" ${!hasDrink || menuTab === 'pizza' ? 'hidden' : ''}>
            <div class="pz-product-grid">${renderDrinkGrid()}</div>
            <div class="pz-builder" id="drinkBuilder"></div>
          </div>
        </section>` : ''}

        <section class="pz-section">
          <div class="pz-section__head">
            <h3>Dados para entrega</h3>
            <p>Onde enviamos seu pedido?</p>
          </div>
          <div class="pz-form-card">
            <div class="pz-form-grid">
              <label class="pz-field"><span>Nome completo</span>
                <input id="customerName" type="text" placeholder="Seu nome" autocomplete="name"></label>
              <label class="pz-field"><span>Telefone / WhatsApp</span>
                <input id="customerPhone" type="tel" placeholder="(77) 99999-9999" autocomplete="tel"></label>
              <label class="pz-field"><span>Bairro</span>
                <select id="neighborhood"><option value="">Selecione o bairro...</option>
                  ${menu.neighborhoods.map((n) => `<option value="${n.id}" data-fee="${n.fee}">${escapeHtml(n.name)} · entrega ${formatMoney(n.fee)}</option>`).join('')}
                </select></label>
              <label class="pz-field"><span>Forma de pagamento</span>
                <select id="payment"><option value="">Selecione...</option>
                  <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option>
                </select></label>
            </div>
            <label class="pz-field pz-field--full"><span>Endereço completo</span>
              <input id="customerAddress" type="text" placeholder="Rua, número, complemento, ponto de referência"></label>
            <label class="pz-field pz-field--full"><span>Observações</span>
              <textarea class="pz-textarea" id="observations" rows="2" placeholder="Sem cebola, troco para R$ 50, interfone quebrado..."></textarea></label>
          </div>
        </section>
      </div>

      <aside class="pz-sidebar">
        <div class="pz-sidebar__sticky">
          <div class="pz-sacola">
            <div class="pz-sacola__head">
              <h3>Sua sacola</h3>
              <span id="sidebarTotal" class="pz-sacola__total">${formatMoney(0)}</span>
            </div>
            <div class="pz-sacola__body" id="cartList"></div>
            <div class="pz-sacola__summary" id="cartSummary"></div>
            <button type="button" class="pz-checkout-btn" id="whatsappBtn" disabled>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Finalizar no WhatsApp
            </button>
          </div>
        </div>
      </aside>
    </div>

    <div class="pz-floating-cart">
      <button type="button" class="pz-floating-cart__button" id="floatingCart" hidden>
        <strong id="floatingCartLabel">Ver Sacola</strong>
        <span id="floatingCartTotal">R$ 0,00</span>
      </button>
    </div>

    <div class="pz-cart-drawer" id="cartPanel" aria-hidden="true">
      <div class="pz-cart-drawer__backdrop" data-close-cart></div>
      <div class="pz-cart-drawer__sheet">
        <div class="pz-cart-drawer__header">
          <div>
            <h3>Sua sacola</h3>
            <p id="cartDrawerTotal">R$ 0,00</p>
          </div>
          <button type="button" class="pz-cart-drawer__close" data-close-cart aria-label="Fechar sacola">✕</button>
        </div>
        <div class="pz-cart-drawer__body" id="cartDrawerList"></div>
        <div class="pz-cart-drawer__summary" id="cartDrawerSummary"></div>
        <button type="button" class="pz-checkout-btn" id="whatsappBtnDrawer">Finalizar no WhatsApp</button>
      </div>
    </div>

    <footer class="pz-mobile-bar">
      <div class="pz-mobile-bar__total">
        <small>Total do pedido</small>
        <strong id="footerTotal">${formatMoney(0)}</strong>
      </div>
      <button type="button" class="pz-mobile-bar__btn" id="whatsappBtnMobile" disabled>Enviar pedido</button>
    </footer>`;

  bindEvents();
  if (hasPizza) renderPizzaBuilder();
  if (hasDrink) renderDrinkBuilder();
  renderCart();
  if (!hasPizza && hasDrink) switchMenuTab('bebida');
}

function bindEvents() {
  document.querySelectorAll('.pz-segment__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchMenuTab(btn.dataset.tab);
      if (btn.dataset.tab === 'pizza') renderPizzaBuilder();
      else renderDrinkBuilder();
    });
  });

  document.querySelectorAll('.pz-product-card--pizza').forEach((card) => {
    card.addEventListener('click', () => {
      selectedFlavorId = card.dataset.flavorId;
      selectedSize = null;
      document.querySelectorAll('.pz-product-card--pizza').forEach((c) => {
        c.classList.toggle('selected', c.dataset.flavorId === selectedFlavorId);
      });
      renderPizzaBuilder();
      document.getElementById('pizzaBuilder')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  document.querySelectorAll('.pz-product-card--drink').forEach((card) => {
    card.addEventListener('click', () => {
      selectedDrinkId = card.dataset.drinkId;
      selectedSize = null;
      document.querySelectorAll('.pz-product-card--drink').forEach((c) => {
        c.classList.toggle('selected', c.dataset.drinkId === selectedDrinkId);
      });
      renderDrinkBuilder();
      document.getElementById('drinkBuilder')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  document.getElementById('neighborhood')?.addEventListener('change', (e) => {
    deliveryFee = parseFloat(e.target.selectedOptions[0]?.dataset.fee) || 0;
    renderCart();
  });

  const removeCartItem = (target) => {
    const btn = target.closest('[data-remove]');
    if (!btn) return;
    cart.splice(parseInt(btn.dataset.remove, 10), 1);
    renderCart();
  };

  document.getElementById('cartList')?.addEventListener('click', (e) => {
    removeCartItem(e.target);
  });

  document.getElementById('cartDrawerList')?.addEventListener('click', (e) => {
    removeCartItem(e.target);
  });

  document.getElementById('whatsappBtn')?.addEventListener('click', sendWhatsApp);
  document.getElementById('whatsappBtnMobile')?.addEventListener('click', sendWhatsApp);
  document.getElementById('floatingCart')?.addEventListener('click', () => {
    const cartPanel = document.getElementById('cartPanel');
    if (cartPanel) {
      cartPanel.classList.add('is-open');
      cartPanel.setAttribute('aria-hidden', 'false');
    }
  });

  document.querySelectorAll('[data-close-cart]').forEach((el) => {
    el.addEventListener('click', () => {
      const cartPanel = document.getElementById('cartPanel');
      if (cartPanel) {
        cartPanel.classList.remove('is-open');
        cartPanel.setAttribute('aria-hidden', 'true');
      }
    });
  });

  document.getElementById('whatsappBtnDrawer')?.addEventListener('click', sendWhatsApp);

  document.querySelectorAll('.pz-highlight-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      highlightIndex = Number(dot.dataset.slide);
      updateHighlightSlider();
    });
  });

  initHighlights();
}

async function init() {
  menu = await loadMenu();
  if (!menu || (!menu.flavors?.length && !menu.drinks?.length)) {
    renderUnavailable();
    return;
  }
  menu.flavors = menu.flavors || [];
  menu.drinks = menu.drinks || [];
  menu.categories = menu.categories || [];
  menu.neighborhoods = menu.neighborhoods || [];
  menuTab = menu.flavors.length ? 'pizza' : 'bebida';
  renderApp();
}

document.addEventListener('DOMContentLoaded', init);
