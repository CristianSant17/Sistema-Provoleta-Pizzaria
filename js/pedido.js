/**
 * PROVOLETA — Página pública de pedidos (pedido.html)
 * Layout inspirado em apps de delivery (cardápio + sacola lateral).
 */

import { formatMoney, escapeHtml, normalizeWhatsApp, whatsappUrl, getPizzaSizeRules, getPizzaFractionLabel, getPizzaSelectionStatus, calculatePizzaPrice, buildPizzaDisplayName, getPizzaFractionOptions, getPizzaBuilderState, getPizzaPortionLabel } from './utils.js';
import { normalizePublicMenu } from './public-menu.js';
import { PUBLIC_MENU_FILE, DEFAULT_WHATSAPP_NUMBER } from './constants.js';
import { getFavoriteFlavors, saveFavoriteFlavors, toggleFavoriteFlavor, getLastOrder, saveLastOrder } from './storage.js';

const CART_STORAGE_KEY = 'provoleta_public_cart';

let menu = null;
let cart = [];
let deliveryFee = 0;
let orderMode = 'delivery';
let menuTab = 'pizza';
let selectedFlavorId = null;
let selectedDrinkId = null;
let selectedSize = null;
let pizzaBuilderFlavors = [];
let customizationModal = null;
let customizationState = null;
let sidebarCollapsed = false;
let favoriteFlavors = [];
let lastOrder = null;
let wallpaperCarouselTimer = null;
let appliedCoupon = null;
let couponMessage = '';

async function loadMenu() {
  try {
    const res = await fetch(`${PUBLIC_MENU_FILE}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('not found');
    return normalizePublicMenu(await res.json());
  } catch {
    return null;
  }
}

function loadCartState() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function saveCartState() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
      cart,
      deliveryFee,
      orderMode,
      appliedCoupon,
      couponMessage,
    }));
  } catch {
    // Ignora falhas de armazenamento do navegador.
  }
}

function showToast(msg, error = false) {
  const el = document.createElement('div');
  el.className = `pz-toast${error ? ' pz-toast--error' : ''}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function showValidationError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) {
    showToast(message, true);
    return;
  }
  const wrapper = field.closest('.pz-field');
  if (wrapper) wrapper.classList.add('pz-field--error');
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  field.focus({ preventScroll: true });
  setTimeout(() => {
    if (wrapper) wrapper.classList.remove('pz-field--error');
  }, 2400);
  showToast(message, true);
}

function updateSidebarState() {
  const sidebar = document.querySelector('.pz-sidebar');
  const toggle = document.getElementById('pzSidebarToggle');
  if (!sidebar || !toggle) return;
  sidebar.classList.toggle('pz-sidebar--collapsed', sidebarCollapsed);
  toggle.textContent = sidebarCollapsed ? 'Abrir sacola' : 'Fechar sacola';
}

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  updateSidebarState();
}

function sendSupportWhatsApp() {
  const text = 'Olá, queria ter um atendimento personalizado e tirar dúvidas.';
  const url = whatsappUrl(normalizeWhatsApp(menu.store.whatsapp) || DEFAULT_WHATSAPP_NUMBER, text);
  if (url) window.open(url, '_blank');
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

function isFavoriteFlavor(flavorId) {
  return favoriteFlavors.includes(flavorId);
}

function formatOrderSummary(order) {
  if (!order || !Array.isArray(order.items)) return '';
  const items = order.items.map((item) => `${item.quantity}x ${item.name} (${sizeLabel(item.size)})`).join(', ');
  const total = formatMoney(order.total || 0);
  return `${items} · ${total}`;
}

function isCouponExpired(coupon) {
  if (!coupon || !coupon.expiresAt) return false;
  const expires = new Date(coupon.expiresAt);
  return Number.isFinite(expires.getTime()) ? expires < new Date() : false;
}

function getActiveCoupon() {
  if (!menu?.coupons?.length) return null;
  const now = new Date();
  return menu.coupons.find((coupon) => {
    if (!coupon || !coupon.active) return false;
    if (coupon.expiresAt && new Date(coupon.expiresAt) < now) return false;
    return true;
  }) || null;
}

function couponMatchesCart(coupon) {
  if (!coupon) return false;
  if (coupon.minOrderValue && cartSubtotal() < coupon.minOrderValue) return false;
  if (coupon.productIds?.length) {
    return cart.some((item) => coupon.productIds.includes(item.itemId));
  }
  return true;
}

function findCouponByCode(code) {
  if (!menu?.coupons?.length || !code) return null;
  const norm = String(code || '').trim().toLowerCase();
  return menu.coupons.find((c) => String(c.code || '').trim().toLowerCase() === norm) || null;
}

function computeCouponDiscount(coupon) {
  if (!coupon) return 0;
  const subtotal = cartSubtotal();
  if (coupon.type === 'percent' && coupon.value) {
    return Math.min(subtotal, subtotal * (parseFloat(coupon.value) / 100));
  }
  if (coupon.type === 'fixed' && coupon.value) {
    return Math.min(subtotal, parseFloat(coupon.value));
  }
  return 0;
}

function applyCouponCode(code) {
  couponMessage = '';
  const coupon = findCouponByCode(code);
  if (!coupon) { couponMessage = 'Cupom não encontrado.'; showToast(couponMessage, true); renderCart(); return false; }
  if (!coupon.active || isCouponExpired(coupon)) { couponMessage = 'Cupom inválido ou expirado.'; showToast(couponMessage, true); renderCart(); return false; }
  if (coupon.minOrderValue && cartSubtotal() < coupon.minOrderValue) {
    couponMessage = `Requer pedido mínimo de ${formatMoney(coupon.minOrderValue)}.`;
    showToast(couponMessage, true);
    renderCart();
    return false;
  }
  if (coupon.productIds?.length && !couponMatchesCart(coupon)) {
    couponMessage = 'Adicione os produtos elegíveis para usar este cupom.';
    showToast(couponMessage, true);
    renderCart();
    return false;
  }
  appliedCoupon = coupon;
  couponMessage = `Cupom ${coupon.code} aplicado.`;
  showToast(couponMessage);
  renderCart();
  return true;
}

function removeAppliedCoupon() {
  if (!appliedCoupon) return;
  const code = appliedCoupon.code;
  appliedCoupon = null;
  couponMessage = '';
  showToast(`Cupom ${code} removido.`);
  renderCart();
}

function buildCouponBannerMarkup() {
  const coupon = getActiveCoupon();
  if (!coupon) return '';

  const pieces = [];
  if (coupon.freeShipping) pieces.push('Frete grátis');
  if (coupon.type === 'percent' && coupon.value) pieces.push(`${parseFloat(coupon.value)}% de desconto`);
  if (coupon.type === 'fixed' && coupon.value) pieces.push(`R$ ${formatMoney(coupon.value)} de desconto`);
  if (!coupon.freeShipping && !coupon.type) pieces.push('Promoção ativa');
  if (coupon.minOrderValue) pieces.push(`A partir de ${formatMoney(coupon.minOrderValue)}`);
  if (coupon.productIds?.length) pieces.push('Produtos selecionados');
  const qualifies = couponMatchesCart(coupon);
  return `
    <section class="pz-coupon-banner">
      <div>
        <p class="pz-coupon-banner__eyebrow">Cupom ativo</p>
        <h3>${escapeHtml(coupon.code)}</h3>
        <p>${escapeHtml(coupon.description || pieces.join(' · ') || 'Oferta disponível para seu pedido')}</p>
        <small>${qualifies ? 'Seu pedido já pode usar este cupom.' : 'Adicione itens para aproveitar esta oferta.'}</small>
      </div>
      <div class="pz-coupon-banner__meta">
        ${coupon.expiresAt ? `<span>Válido até ${new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}</span>` : ''}
        <span class="pz-coupon-banner__status">${coupon.active ? 'Ativo' : 'Inativo'}</span>
      </div>
    </section>`;
}

function sizeLabel(size) {
  return { P: 'Pequena', M: 'Média', G: 'Grande', Lata: 'Lata', '1L': '1 Litro' }[size] || size;
}

function paymentLabel(p) {
  return { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão' }[p] || p;
}

function getFlavorImageUrls(flavor) {
  const values = [];
  if (typeof flavor?.imageUrl === 'string' && flavor.imageUrl.trim()) {
    values.push(flavor.imageUrl.trim());
  }
  const extraImages = Array.isArray(flavor?.extraImages)
    ? flavor.extraImages
    : (typeof flavor?.extraImages === 'string' ? flavor.extraImages.split(',') : []);

  extraImages.forEach((entry) => {
    const value = String(entry || '').trim();
    if (value && !values.includes(value)) values.push(value);
  });

  return values;
}

function getFlavorImageMarkup(flavor, fallback = '🍕') {
  const imageUrls = getFlavorImageUrls(flavor);
  if (imageUrls.length) {
    return `<div class="pz-product-card__image"><img src="${imageUrls[0]}" alt="${escapeHtml(flavor?.name || 'Pizza')}" loading="lazy"></div>`;
  }
  return `<div class="pz-product-card__image pz-product-card__image--fallback">${fallback}</div>`;
}

function escapeCssUrl(url) {
  return String(url || '').replace(/'/g, "\\'");
}

function getFlavorCategoryLabel(flavor) {
  const category = menu?.categories?.find((c) => c.id === flavor?.categoryId);
  return category?.name || 'Sabor';
}

function getFlavorDescription(flavor) {
  const direct = [flavor?.description, flavor?.shortDescription, flavor?.details, flavor?.summary]
    .find((value) => typeof value === 'string' && value.trim());
  if (direct) return direct.trim();

  const ingredients = Array.isArray(flavor?.ingredients)
    ? flavor.ingredients.filter(Boolean)
    : (typeof flavor?.ingredients === 'string' ? flavor.ingredients.split(',').map((entry) => entry.trim()).filter(Boolean) : []);
  if (ingredients.length) {
    return `Ingredientes: ${ingredients.join(', ')}`;
  }

  const name = String(flavor?.name || '').toLowerCase();
  if (name.includes('calabresa')) return 'Pizza tradicional com calabresa e molho especial.';
  if (name.includes('quatro') && name.includes('queijo')) return 'Pizza cremosa com uma mistura de queijos.';
  if (name.includes('frango') && name.includes('catupiry')) return 'Pizza com frango e catupiry, bem cremosa.';
  if (name.includes('atum')) return 'Pizza com atum e sabor marcante.';
  return 'Sabor disponível para montar seu pedido.';
}

function cartSubtotal() {
  return cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
}

function cartTotal() {
  const subtotal = cartSubtotal();
  const discount = appliedCoupon && couponMatchesCart(appliedCoupon) ? computeCouponDiscount(appliedCoupon) : 0;
  const effectiveDelivery = appliedCoupon && appliedCoupon.freeShipping ? 0 : (cart.length ? deliveryFee : 0);
  return Math.max(0, subtotal - discount) + effectiveDelivery;
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
  const drawerHeaderCount = document.getElementById('cartDrawerCount');
  const drawerHeaderSubtotal = document.getElementById('cartDrawerSubtotal');
  const floatingCartLabel = document.getElementById('floatingCartLabel');
  const floatingCartTotal = document.getElementById('floatingCartTotal');

  const count = cartCount();
  // Auto-apply active coupon if none applied
  if (!appliedCoupon) {
    const active = getActiveCoupon();
    if (active && couponMatchesCart(active)) {
      appliedCoupon = active;
      showToast(`Cupom ${active.code} aplicado automaticamente.`);
    }
  }
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
    if (drawerHeaderCount) drawerHeaderCount.textContent = '0 itens';
    if (drawerHeaderSubtotal) drawerHeaderSubtotal.textContent = `Subtotal ${zero}`;
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
    ${appliedCoupon && couponMatchesCart(appliedCoupon) ? `<div class="pz-summary-row pz-summary-row--discount"><span>Cupom ${escapeHtml(appliedCoupon.code)}</span><span>-${formatMoney(computeCouponDiscount(appliedCoupon))} <button type="button" id="removeCouponBtn" class="pz-link-btn">Remover</button></span></div>` : ''}
    <div class="pz-summary-row"><span>${orderMode === 'pickup' ? 'Retirada' : 'Taxa de entrega'}</span><span>${formatMoney(deliveryFee)}</span></div>
    <div class="pz-summary-row pz-summary-row--total"><span>Total</span><span>${formatMoney(cartTotal())}</span></div>
    <div class="pz-summary-row pz-summary-row--coupon">
      <input id="couponCode" placeholder="Código do cupom" />
      <button type="button" id="applyCouponBtn">Aplicar</button>
    </div>
    ${couponMessage ? `<div class="pz-coupon-message">${escapeHtml(couponMessage)}</div>` : ''}`;

  const total = formatMoney(cartTotal());
  if (btn) btn.disabled = false;
  if (btnMobile) btnMobile.disabled = false;
  if (footerTotal) footerTotal.textContent = total;
  if (sidebarTotal) sidebarTotal.textContent = total;
  if (floatingCart) {
    floatingCart.hidden = false;
    floatingCart.onclick = openCartDrawer;
    if (floatingCartLabel) floatingCartLabel.textContent = `Ver Sacola (${count} itens)`;
    if (floatingCartTotal) floatingCartTotal.textContent = total;
  }

  if (drawerHeaderCount) drawerHeaderCount.textContent = `${count} item${count > 1 ? 's' : ''}`;
  if (drawerHeaderSubtotal) drawerHeaderSubtotal.textContent = `Subtotal ${formatMoney(cartSubtotal())}`;
  if (drawerSummary) drawerSummary.innerHTML = `
    ${appliedCoupon && couponMatchesCart(appliedCoupon) ? `<div class="pz-summary-row pz-summary-row--discount"><span>Cupom ${escapeHtml(appliedCoupon.code)}</span><span>-${formatMoney(computeCouponDiscount(appliedCoupon))} <button type="button" id="removeCouponBtnDrawer" class="pz-link-btn">Remover</button></span></div>` : ''}
    <div class="pz-summary-row"><span>${orderMode === 'pickup' ? 'Retirada' : 'Taxa de entrega'}</span><span>${formatMoney(deliveryFee)}</span></div>
    <div class="pz-summary-row pz-summary-row--total"><span>Total</span><span>${total}</span></div>
    <div class="pz-summary-row pz-summary-row--coupon">
      <input id="couponCodeDrawer" placeholder="Código do cupom" />
      <button type="button" id="applyCouponBtnDrawer">Aplicar</button>
    </div>
    ${couponMessage ? `<div class="pz-coupon-message">${escapeHtml(couponMessage)}</div>` : ''}`;

  saveCartState();

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

  // Bind coupon controls
  const applyBtn = document.getElementById('applyCouponBtn');
  const couponInput = document.getElementById('couponCode');
  if (applyBtn && couponInput) {
    applyBtn.onclick = () => applyCouponCode(couponInput.value.trim());
  }
  const applyBtnDrawer = document.getElementById('applyCouponBtnDrawer');
  const couponInputDrawer = document.getElementById('couponCodeDrawer');
  if (applyBtnDrawer && couponInputDrawer) {
    applyBtnDrawer.onclick = () => applyCouponCode(couponInputDrawer.value.trim());
  }

  const removeBtn = document.getElementById('removeCouponBtn');
  if (removeBtn) removeBtn.onclick = removeAppliedCoupon;
  const removeBtnDrawer = document.getElementById('removeCouponBtnDrawer');
  if (removeBtnDrawer) removeBtnDrawer.onclick = removeAppliedCoupon;
}

function openCartDrawer() {
  const cartPanel = document.getElementById('cartPanel');
  const floatingCart = document.getElementById('floatingCart');
  if (cartPanel) {
    cartPanel.classList.add('is-open');
    cartPanel.removeAttribute('inert');
    cartPanel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('pz-lock-scroll');
  }
  if (floatingCart) {
    floatingCart.hidden = true;
  }
}

function closeCartDrawer() {
  const cartPanel = document.getElementById('cartPanel');
  const floatingCart = document.getElementById('floatingCart');
  if (cartPanel) {
    cartPanel.classList.remove('is-open');
    cartPanel.setAttribute('inert', '');
    cartPanel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('pz-lock-scroll');
  }
  if (floatingCart) {
    floatingCart.hidden = cartCount() === 0;
  }

  const fallbackTarget = document.getElementById('whatsappBtn') || document.getElementById('whatsappBtnMobile') || document.querySelector('.pz-sidebar-toggle');
  if (fallbackTarget && typeof fallbackTarget.focus === 'function') {
    fallbackTarget.focus({ preventScroll: true });
  }
}

function findInvalidField() {
  const formFields = [
    'customerName',
    'customerPhone',
    orderMode === 'delivery' ? 'neighborhood' : null,
    orderMode === 'delivery' ? 'customerAddress' : null,
    'payment'
  ].filter(Boolean);
  return formFields.find((fieldId) => {
    const field = document.getElementById(fieldId);
    return field && !field.value.trim();
  });
}

function openPaymentSection() {
  const paymentSection = document.getElementById('orderDetailsSection');
  if (paymentSection) {
    paymentSection.classList.add('pz-section--open');
    paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function validateOrderForm() {
  if (!document.getElementById('customerName').value.trim()) { openPaymentSection(); showValidationError('customerName', 'Informe seu nome.'); return false; }
  if (!document.getElementById('customerPhone').value.trim()) { openPaymentSection(); showValidationError('customerPhone', 'Informe seu telefone.'); return false; }
  if (orderMode === 'delivery') {
    if (!document.getElementById('neighborhood').value) { openPaymentSection(); showValidationError('neighborhood', 'Selecione o bairro.'); return false; }
    if (!document.getElementById('customerAddress').value.trim()) { openPaymentSection(); showValidationError('customerAddress', 'Informe o endereço.'); return false; }
  }
  if (!document.getElementById('payment').value) { openPaymentSection(); showValidationError('payment', 'Selecione a forma de pagamento.'); return false; }
  return true;
}

function addItemToCart({ type, item, size, quantity, basePrice, selectedAdditionals = [], flavors = [] }) {
  const unitPrice = basePrice + selectedAdditionals.reduce((sum, extra) => sum + (extra.price || 0), 0);
  const displayName = type === 'pizza'
    ? buildPizzaDisplayName({ size, flavors: flavors.length ? flavors : [{ id: item.id, name: item.name, fraction: 1, fractionLabel: '1/1' }] })
    : item.name;
  cart.push({
    itemId: item.id,
    type,
    name: displayName,
    size,
    quantity,
    unitPrice,
    additionals: selectedAdditionals,
    flavors: type === 'pizza' ? flavors : [],
  });
  renderCart();
  showToast(`${displayName} adicionada!`);
  selectedSize = null;
  pizzaBuilderFlavors = [];
  saveCartState();
  if (type === 'pizza') {
    renderPizzaBuilder();
    document.querySelectorAll('.pz-product-card--pizza').forEach((card) => {
      card.classList.toggle('selected', card.dataset.flavorId === selectedFlavorId);
    });
  } else {
    renderDrinkBuilder();
  }
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
          ${getFlavorImageUrls(item).length ? `<img src="${getFlavorImageUrls(item)[0]}" alt="${escapeHtml(item.name)}">` : '<div class="pz-product-card__image--fallback">🍕</div>'}
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
  const { type, item, size, quantity, basePrice, selectedAdditionals, flavors } = customizationState;
  addItemToCart({ type, item, size, quantity, basePrice, selectedAdditionals, flavors });
  closeCustomizationModal();
}

function openCustomizationModal(config) {
  if (config.type !== 'pizza') {
    addItemToCart({
      type: config.type,
      item: config.item,
      size: config.size,
      quantity: config.quantity,
      basePrice: config.basePrice,
      selectedAdditionals: [],
    });
    return;
  }

  if (!(menu?.additionals || []).length) {
    addItemToCart({
      type: config.type,
      item: config.item,
      size: config.size,
      quantity: config.quantity,
      basePrice: config.basePrice,
      selectedAdditionals: [],
      flavors: config.flavors || [],
    });
    return;
  }

  customizationState = {
    type: config.type,
    item: config.item,
    size: config.size,
    quantity: config.quantity,
    basePrice: config.basePrice,
    selectedAdditionals: [],
    flavors: config.flavors || [],
  };
  if (!customizationModal) {
    customizationModal = document.createElement('div');
    customizationModal.id = 'customizationModal';
    document.body.appendChild(customizationModal);
  }
  renderCustomizationModal();
}

function buildPizzaFlavorRows(portionValue) {
  const flavor = menu.flavors.find((item) => item.id === selectedFlavorId);
  if (!selectedSize || !flavor) return [];
  const portionCount = portionValue === 1 ? 1 : portionValue === 0.5 ? 2 : portionValue === 1 / 3 ? 3 : 4;
  const rows = [];
  const firstRow = pizzaBuilderFlavors[0] && pizzaBuilderFlavors[0].id
    ? { id: pizzaBuilderFlavors[0].id, name: pizzaBuilderFlavors[0].name }
    : { id: flavor.id, name: flavor.name };
  rows.push(firstRow);

  for (let index = 1; index < portionCount; index += 1) {
    const existing = pizzaBuilderFlavors[index];
    rows.push({
      id: existing?.id || '',
      name: existing?.name || '',
    });
  }

  return rows;
}

function renderPizzaBuilder(targetEl = document.getElementById('pizzaBuilder')) {
  const el = targetEl;
  if (!el) return;

  if (!selectedFlavorId) {
    el.innerHTML = '<p class="pz-builder-hint">Toque em um sabor para começar a montar sua pizza</p>';
    return;
  }

  const flavor = menu.flavors.find((f) => f.id === selectedFlavorId);
  const prices = getFlavorPrices(selectedFlavorId);
  if (!flavor || !prices) return;

  const size = selectedSize || '';
  const rules = getPizzaSizeRules(size);
  const builderState = getPizzaBuilderState(size, pizzaBuilderFlavors);
  const hasSize = Boolean(size);
  const addableEntries = builderState.entries;
  const basePrice = hasSize ? calculatePizzaPrice({ size, flavors: builderState.entries, additionals: [], flavorCatalog: menu.flavors, categoryCatalog: menu.categories }) : 0;
  const fractionOptions = getPizzaFractionOptions(size);

  const rowsMarkup = addableEntries.length ? addableEntries.map((entry, index) => `
    <div class="pz-builder-row">
      <select class="pz-builder-row__select" data-row-index="${index}" data-field="flavor">
        <option value="">Selecione um sabor</option>
        ${menu.flavors.map((option) => `<option value="${option.id}" ${option.id === entry.id ? 'selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}
      </select>
      <div class="pz-builder-fraction-pill">
        <span class="pz-builder-fraction-pill__label">${entry.fraction > 0 ? getPizzaPortionLabel(entry.fraction) : 'Escolha o sabor'}</span>
      </div>
      ${index > 0 ? `<button type="button" class="pz-builder-row__remove" data-row-index="${index}" aria-label="Remover sabor">✕</button>` : ''}
    </div>`).join('') : `
    <div class="pz-builder-row pz-builder-row--empty">
      <div class="pz-builder-row__placeholder">${hasSize ? 'Escolha a quantidade de sabores usando os botões acima.' : 'Selecione o tamanho primeiro para ver as opções de sabores.'}</div>
    </div>`;

  const fractionButtonsMarkup = hasSize ? fractionOptions.map((option) => `
    <button type="button" class="pz-fraction-btn ${builderState.entries.length === (1 / option.value) ? 'active' : ''}" data-fraction="${option.value}">
      <span>${escapeHtml(option.label)}</span>
      <small>${escapeHtml(option.helper)}</small>
    </button>`).join('') : '';

  el.innerHTML = `
    <div class="pz-builder-head">
      <strong>${escapeHtml(flavor.name)}</strong>
      <span class="pz-builder-cat">${escapeHtml(prices.category)}</span>
    </div>
    <p class="pz-builder-label">Monte sua pizza</p>
    <p class="pz-builder-hint">${size ? `Escolha quantos sabores quer na pizza (${rules.maxFlavors} no máximo)` : 'Escolha o tamanho para liberar as opções'}</p>
    <div class="pz-size-grid">
      ${['P', 'M', 'G'].map((s) => `
        <button type="button" class="pz-size-btn ${selectedSize === s ? 'active' : ''}" data-size="${s}">
          <span class="pz-size-btn__label">${s === 'P' ? 'Pequena' : s === 'M' ? 'Média' : 'Grande'}</span>
          <span class="pz-size-btn__price">${formatMoney(prices[s])}</span>
        </button>`).join('')}
    </div>
    ${hasSize ? `<div class="pz-fraction-options">${fractionButtonsMarkup}</div>` : ''}
    <div class="pz-builder-rows">${rowsMarkup}</div>
    <p class="pz-builder-hint" id="pizzaStatusHint">${builderState.isComplete ? 'Pizza pronta para adicionar.' : builderState.entries.length ? `Preencha o restante da pizza (Falta ${builderState.remainingLabel})` : 'Escolha a quantidade de sabores acima.'}</p>
    <div class="pz-builder-footer">
      <div class="pz-qty">
        <button type="button" class="pz-qty__btn" id="pizzaQtyMinus">−</button>
        <span id="pizzaQtyVal">1</span>
        <button type="button" class="pz-qty__btn" id="pizzaQtyPlus">+</button>
      </div>
      <button type="button" class="pz-btn-add-cart" id="addPizza" ${!selectedSize || !builderState.isValid ? 'disabled' : ''}>
        ${builderState.isValid ? `Adicionar · ${selectedSize ? formatMoney(basePrice) : '—'}` : `Preencha o restante da pizza (Falta ${builderState.remainingLabel})`}
      </button>
    </div>`;

  el.querySelectorAll('.pz-size-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedSize = btn.dataset.size;
      const rules = getPizzaSizeRules(selectedSize);
      pizzaBuilderFlavors = pizzaBuilderFlavors.slice(0, rules.maxFlavors);
      renderPizzaBuilder(el);
    });
  });

  el.querySelectorAll('.pz-fraction-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fractionValue = Number(btn.dataset.fraction);
      if (!selectedSize) return;
      pizzaBuilderFlavors = buildPizzaFlavorRows(fractionValue);
      renderPizzaBuilder(el);
    });
  });

  el.querySelectorAll('[data-field="flavor"]').forEach((select) => {
    select.addEventListener('change', (event) => {
      const rowIndex = Number(event.target.dataset.rowIndex);
      const chosenFlavor = menu.flavors.find((item) => item.id === event.target.value);
      pizzaBuilderFlavors[rowIndex] = {
        ...pizzaBuilderFlavors[rowIndex],
        id: chosenFlavor?.id || '',
        name: chosenFlavor?.name || '',
      };
      renderPizzaBuilder(el);
    });
  });

  el.querySelectorAll('.pz-builder-row__remove').forEach((button) => {
    button.addEventListener('click', (event) => {
      const rowIndex = Number(event.currentTarget.dataset.rowIndex);
      pizzaBuilderFlavors.splice(rowIndex, 1);
      renderPizzaBuilder(el);
    });
  });

  el.querySelector('#addPizzaFlavorRow')?.addEventListener('click', () => {
    const size = selectedSize;
    const state = getPizzaBuilderState(size, pizzaBuilderFlavors);
    if (!size || !state.canAddFlavor) return;
    pizzaBuilderFlavors = [...pizzaBuilderFlavors, { id: '', name: '' }];
    renderPizzaBuilder(el);
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
    const size = selectedSize;
    const status = getPizzaSelectionStatus(size, pizzaBuilderFlavors);
    if (!size) { showToast('Escolha o tamanho.', true); return; }
    if (!status.valid) { showToast(status.message, true); return; }
    openCustomizationModal({
      type: 'pizza',
      item: flavor,
      size,
      quantity: qty,
      basePrice: calculatePizzaPrice({ size, flavors: status.normalized, additionals: [], flavorCatalog: menu.flavors, categoryCatalog: menu.categories }),
      flavors: status.normalized.filter((entry) => entry.id && Number(entry.fraction || 0) > 0),
    });
  });
}

function renderDrinkBuilder(targetEl = document.getElementById('drinkBuilder')) {
  const el = targetEl;
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
      renderDrinkBuilder(el);
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

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function categoryIcon(name) {
  const normalized = String(name || '').toLowerCase();
  if (normalized.includes('doce') || normalized.includes('sobremesa')) return '🍰';
  if (normalized.includes('beb')) return '🥤';
  return '🍕';
}

function getMenuCategories() {
  const categories = [];
  const seen = new Set();
  (menu.categories || []).forEach((category) => {
    if (!seen.has(category.id)) {
      seen.add(category.id);
      categories.push(category);
    }
  });

  if (categories.length) return categories;

  const fallbackName = menu.flavors.length ? 'Pizzas' : 'Itens';
  return [{ id: 'fallback', name: fallbackName, priceP: 0, priceM: 0, priceG: 0 }];
}

function getCategoryFlavors(category) {
  if (!category || category.id === 'fallback') {
    return menu.flavors.filter((flavor) => !flavor.categoryId || flavor.categoryId === '');
  }
  return menu.flavors.filter((flavor) => flavor.categoryId === category.id);
}

function buildCategoryNavMarkup() {
  const entries = [];
  const categories = getMenuCategories();
  categories.forEach((category) => {
    const hasItems = getCategoryFlavors(category).length > 0;
    if (hasItems) {
      entries.push({ id: `cat-${slugify(category.name)}`, label: category.name, icon: categoryIcon(category.name) });
    }
  });

  if (menu.drinks.length) {
    entries.push({ id: 'cat-bebidas', label: 'Bebidas', icon: '🥤' });
  }

  if (!entries.length) return '';

  return `
    <nav class="pz-category-nav" aria-label="Categorias do cardápio">
      ${entries.map((entry) => `<button type="button" class="pz-category-nav__btn" data-target="${entry.id}">${entry.icon} ${escapeHtml(entry.label)}</button>`).join('')}
    </nav>`;
}

function buildCategorySectionsMarkup() {
  const sections = [];
  const categories = getMenuCategories();

  categories.forEach((category) => {
    const flavors = getCategoryFlavors(category);
    if (!flavors.length) return;

    sections.push(`
      <section class="pz-menu-section" id="cat-${slugify(category.name)}">
        <div class="pz-menu-section__head">
          <div class="pz-menu-section__title">
            <span class="pz-menu-section__icon">${categoryIcon(category.name)}</span>
            <h4>${escapeHtml(category.name)}</h4>
          </div>
          <span class="pz-menu-section__count">${flavors.length} sabor${flavors.length > 1 ? 'es' : ''}</span>
        </div>
        <div class="pz-product-grid">
          ${flavors.map((f) => {
            const cat = menu.categories.find((c) => c.id === f.categoryId);
            const from = cat ? formatMoney(Math.min(cat.priceP, cat.priceM, cat.priceG)) : '';
            const image = getFlavorImageMarkup(f);
            return `
              <div class="pz-product-entry" data-product-type="pizza" data-product-id="${f.id}">
                <button type="button" class="pz-product-card pz-product-card--pizza ${selectedFlavorId === f.id ? 'selected' : ''}" data-flavor-id="${f.id}">
                  ${image}
                  <span class="pz-product-card__name">${escapeHtml(f.name)}</span>
                  ${cat ? `<span class="pz-product-card__meta">${escapeHtml(cat.name)} · a partir de ${from}</span>` : ''}
                </button>
              </div>`;
          }).join('')}
        </div>
      </section>`);
  });

  if (menu.drinks.length) {
    sections.push(`
      <section class="pz-menu-section" id="cat-bebidas">
        <div class="pz-menu-section__head">
          <div class="pz-menu-section__title">
            <span class="pz-menu-section__icon">🥤</span>
            <h4>Bebidas Geladas</h4>
          </div>
          <span class="pz-menu-section__count">${menu.drinks.length} opção${menu.drinks.length > 1 ? 'ões' : ''}</span>
        </div>
        <div class="pz-product-grid">
          ${menu.drinks.map((d) => {
            const image = d.imageUrl ? `<div class="pz-product-card__image"><img src="${d.imageUrl}" alt="${escapeHtml(d.name)}" loading="lazy"></div>` : `<div class="pz-product-card__image pz-product-card__image--fallback">🥤</div>`;
            return `
              <div class="pz-product-entry" data-product-type="drink" data-product-id="${d.id}">
                <button type="button" class="pz-product-card pz-product-card--drink ${selectedDrinkId === d.id ? 'selected' : ''}" data-drink-id="${d.id}">
                  ${image}
                  <span class="pz-product-card__name">${escapeHtml(d.name)}</span>
                  <span class="pz-product-card__meta">Lata ${formatMoney(d.priceLata)} · 1L ${formatMoney(d.price1L)}</span>
                </button>
              </div>`;
          }).join('')}
        </div>
      </section>`);
  }

  return sections.join('');
}

function renderFlavorGrid() {
  return menu.flavors.map((f) => {
    const cat = menu.categories.find((c) => c.id === f.categoryId);
    const from = cat ? formatMoney(Math.min(cat.priceP, cat.priceM, cat.priceG)) : '';
    const image = getFlavorImageMarkup(f);
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

function clearInlineBuilders() {
  document.querySelectorAll('.pz-inline-builder').forEach((builder) => builder.remove());
}

function renderBuilder() {
  clearInlineBuilders();

  if (selectedFlavorId) {
    const cardEntry = document.querySelector(`.pz-product-entry[data-product-type="pizza"][data-product-id="${selectedFlavorId}"]`);
    if (cardEntry) {
      const builder = document.createElement('div');
      builder.className = 'pz-inline-builder';
      cardEntry.insertAdjacentElement('afterend', builder);
      renderPizzaBuilder(builder);
      builder.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  if (selectedDrinkId) {
    const cardEntry = document.querySelector(`.pz-product-entry[data-product-type="drink"][data-product-id="${selectedDrinkId}"]`);
    if (cardEntry) {
      const builder = document.createElement('div');
      builder.className = 'pz-inline-builder';
      cardEntry.insertAdjacentElement('afterend', builder);
      renderDrinkBuilder(builder);
      builder.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

function getShowcaseWallpaperImages(flavors) {
  const images = flavors.flatMap((flavor) => getFlavorImageUrls(flavor));
  return [...new Set(images.filter(Boolean))];
}

function buildPizzaShowcaseMarkup() {
  const pizzas = (menu.flavors || []).filter(Boolean);
  if (!pizzas.length) return '';

  const wallpaperImages = getShowcaseWallpaperImages(pizzas);
  const wallpaperSlides = wallpaperImages.map((image, index) => `
      <div class="pz-showcase__wallpaper-slide${index === 0 ? ' is-active' : ''}" style="background-image:url('${escapeCssUrl(image)}')"></div>`).join('');

  return `
    <section class="pz-showcase pz-showcase--wallpaper">
      <div class="pz-showcase__wallpaper">
        ${wallpaperSlides}
      </div>
      <div class="pz-showcase__wallpaper-mask"></div>
      <div class="pz-showcase__wallpaper-body">
        <div class="pz-showcase__head">
          <div>
            <p class="pz-showcase__eyebrow">Pizzas em destaque</p>
            <h3>Os sabores agora são parte do cenário</h3>
            <p class="pz-showcase__subtext">Um papel de parede inspirado nas pizzas mais pedidas, com o cardápio aparecendo em primeiro plano.</p>
          </div>
        </div>
      </div>
    </section>`;
}

function stopWallpaperCarousel() {
  if (wallpaperCarouselTimer) {
    window.clearInterval(wallpaperCarouselTimer);
    wallpaperCarouselTimer = null;
  }
}

function startWallpaperCarousel() {
  stopWallpaperCarousel();
  const slides = Array.from(document.querySelectorAll('.pz-showcase__wallpaper-slide'));
  if (slides.length <= 1) return;

  let current = slides.findIndex((slide) => slide.classList.contains('is-active'));
  if (current < 0) current = 0;
  slides.forEach((slide, index) => slide.classList.toggle('is-active', index === current));

  wallpaperCarouselTimer = window.setInterval(() => {
    const next = (current + 1) % slides.length;
    slides[current].classList.remove('is-active');
    slides[next].classList.add('is-active');
    current = next;
  }, 4200);
}

function buildWhatsAppMessage() {
  const { store } = menu;
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const address = document.getElementById('customerAddress').value.trim();
  const neighborhood = document.getElementById('neighborhood').selectedOptions[0]?.text || '';
  const payment = document.getElementById('payment').value;
  const obs = document.getElementById('observations').value.trim();
  const modeLabel = orderMode === 'pickup' ? 'Retirada' : 'Entrega';

  const lines = [
    ` *NOVO PEDIDO — ${store.name}*`, '',
    ` *Cliente:* ${name}`, ` *Telefone:* ${phone}`,
    ` *Modo de pedido:* ${modeLabel}`,
  ];

  if (orderMode === 'delivery') {
    lines.push(` *Bairro:* ${neighborhood}`, ` *Endereço:* ${address}`);
  } else {
    lines.push(' *Retirada:* cliente buscará o pedido no local.');
  }

  lines.push('', '*ITENS:*');
  cart.forEach((item, i) => {
    const extras = (item.additionals || []).map((a) => a.name).join(', ');
    const details = extras ? ` · extras: ${extras}` : '';
    const itemName = item.type === 'pizza' ? item.name : item.name;
    lines.push(`${i + 1}. ${item.quantity}x ${itemName} (${sizeLabel(item.size)})${details} — ${formatMoney(item.unitPrice * item.quantity)}`);
  });
  lines.push('', ` *Taxa de entrega:* ${formatMoney(deliveryFee)}`, ` *TOTAL: ${formatMoney(cartTotal())}*`, '', ` *Pagamento:* ${paymentLabel(payment)}`);
  if (appliedCoupon && couponMatchesCart(appliedCoupon)) {
    const discount = computeCouponDiscount(appliedCoupon);
    lines.splice(lines.length - 2, 0, ` *Cupom:* ${appliedCoupon.code} — -${formatMoney(discount)}`);
  }
  if (obs) lines.push(` *Obs:* ${obs}`);
  lines.push('', `_Pedido online · ${new Date().toLocaleString('pt-BR')}_`);
  return lines.join('\n');
}

function sendWhatsApp() {
  if (!validateOrderForm()) return;
  if (!cart.length) { showToast('Adicione itens ao pedido.', true); return; }
  const nextLastOrder = {
    items: cart.map((item) => ({ ...item })),
    total: cartTotal(),
    deliveryFee,
    orderMode,
    coupon: appliedCoupon ? { id: appliedCoupon.id, code: appliedCoupon.code, value: appliedCoupon.value, type: appliedCoupon.type } : null,
    createdAt: new Date().toISOString(),
  };
  saveLastOrder(nextLastOrder);
  lastOrder = nextLastOrder;
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

function renderLastOrderBanner() {
  if (!lastOrder || !lastOrder.items?.length) return '';
  return `
    <section class="pz-last-order-banner">
      <div>
        <p class="pz-showcase__eyebrow">Último pedido</p>
        <h3>Repetir seu último pedido?</h3>
        <p>${escapeHtml(formatOrderSummary(lastOrder))}</p>
      </div>
      <button type="button" class="pz-btn-add-cart pz-btn-reorder" id="reorderBtn">Repetir pedido</button>
    </section>`;
}

function updateOrderModeUI() {
  const modeSelect = document.getElementById('orderModeSelect');
  const deliveryFields = document.getElementById('deliveryFields');
  const isDelivery = modeSelect?.value === 'delivery';
  if (deliveryFields) deliveryFields.style.display = isDelivery ? 'block' : 'none';
  if (!isDelivery) {
    deliveryFee = 0;
    const neighborhoodSelect = document.getElementById('neighborhood');
    if (neighborhoodSelect) neighborhoodSelect.value = '';
  } else {
    const neighborhoodSelect = document.getElementById('neighborhood');
    deliveryFee = parseFloat(neighborhoodSelect?.selectedOptions[0]?.dataset.fee) || 0;
  }
  renderCart();
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
        <p class="pz-banner__eyebrow">Peça online · receba ou retire</p>
        <h2>${escapeHtml(store.welcomeMessage)}</h2>
        <div class="pz-banner__pills">
          <span>🛵 Entrega rápida</span>
          <span>💬 Pedido via WhatsApp</span>
          <span>✓ Pagamento na entrega</span>
        </div>
      </div>
    </section>

    ${buildCouponBannerMarkup()}
    ${renderLastOrderBanner()}
    ${buildPizzaShowcaseMarkup()}

    <div class="pz-layout">
      <div class="pz-main-col">
        ${hasPizza || hasDrink ? `
        <section class="pz-section">
          <div class="pz-section__head">
            <h3>Cardápio</h3>
            <p>Escolha os itens e monte seu pedido</p>
          </div>

          ${buildCategoryNavMarkup()}
          <div class="pz-category-sections">
            ${buildCategorySectionsMarkup()}
          </div>

        </section>` : ''}

        <section class="pz-section" id="orderDetailsSection">
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
              <label class="pz-field"><span>Forma de pedido</span>
                <select id="orderModeSelect">
                  <option value="delivery">Entrega</option>
                  <option value="pickup">Retirada</option>
                </select></label>
              <label class="pz-field"><span>Forma de pagamento</span>
                <select id="payment"><option value="">Selecione...</option>
                  <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option>
                </select></label>
            </div>
            <div id="deliveryFields">
              <label class="pz-field"><span>Bairro</span>
                <select id="neighborhood"><option value="">Selecione o bairro...</option>
                  ${menu.neighborhoods.map((n) => `<option value="${n.id}" data-fee="${n.fee}">${escapeHtml(n.name)} · entrega ${formatMoney(n.fee)}</option>`).join('')}
                </select></label>
              <label class="pz-field pz-field--full"><span>Endereço completo</span>
                <input id="customerAddress" type="text" placeholder="Rua, número, complemento, ponto de referência"></label>
            </div>
            <label class="pz-field pz-field--full"><span>Observações</span>
              <textarea class="pz-textarea" id="observations" rows="2" placeholder="Sem cebola, troco para R$ 50, interfone quebrado..."></textarea></label>
          </div>
        </section>
      </div>

      <aside class="pz-sidebar">
        <div class="pz-sidebar__sticky">
          <div class="pz-sacola">
            <div class="pz-sacola__head">
              <div>
                <h3>Sua escolha</h3>
                <button type="button" class="pz-sidebar-toggle" id="pzSidebarToggle">Fechar resumo</button>
              </div>
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
            <h3>Sua escolha</h3>
            <div class="pz-cart-drawer__header-meta">
              <span id="cartDrawerCount">0 itens</span>
              <span id="cartDrawerSubtotal">Subtotal R$ 0,00</span>
            </div>
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
      <button type="button" class="pz-mobile-bar__btn" id="whatsappBtnMobile" disabled>Finalizar no WhatsApp</button>
    </footer>
    <button type="button" class="pz-support-btn" id="pzSupportBtn">
      <span class="pz-support-btn__icon"><img style="width: 200%; height: 100%;" src="assets/whatsapp-icon.png" alt="WhatsApp"></span>
    </button>`;

  bindEvents();
  renderBuilder();
  renderCart();
  updateSidebarState();
  startWallpaperCarousel();
}

function bindEvents() {

  document.querySelectorAll('.pz-category-nav__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  const sections = Array.from(document.querySelectorAll('.pz-menu-section'));
  const navButtons = Array.from(document.querySelectorAll('.pz-category-nav__btn'));

  const setActiveCategory = (activeId) => {
    navButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.target === activeId);
    });
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        setActiveCategory(visible.target.id);
      }
    }, { rootMargin: '-25% 0px -55% 0px', threshold: [0.2, 0.4, 0.6] });

    sections.forEach((section) => observer.observe(section));
  } else {
    const onScroll = () => {
      const scrollY = window.scrollY + 140;
      const current = sections.findLast((section) => scrollY >= section.offsetTop);
      if (current) {
        setActiveCategory(current.id);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  document.querySelectorAll('.pz-product-card--pizza').forEach((card) => {
    card.addEventListener('click', () => {
      selectedFlavorId = card.dataset.flavorId;
      selectedDrinkId = null;
      selectedSize = null;
      const flavor = menu.flavors.find((item) => item.id === selectedFlavorId);
      pizzaBuilderFlavors = flavor ? [{ id: flavor.id, name: flavor.name }] : [];
      document.querySelectorAll('.pz-product-card--pizza').forEach((c) => {
        c.classList.toggle('selected', c.dataset.flavorId === selectedFlavorId);
      });
      document.querySelectorAll('.pz-product-card--drink').forEach((c) => {
        c.classList.remove('selected');
      });
      renderBuilder();
    });
  });

  document.querySelectorAll('.pz-product-card--drink').forEach((card) => {
    card.addEventListener('click', () => {
      selectedDrinkId = card.dataset.drinkId;
      selectedFlavorId = null;
      selectedSize = null;
      document.querySelectorAll('.pz-product-card--drink').forEach((c) => {
        c.classList.toggle('selected', c.dataset.drinkId === selectedDrinkId);
      });
      document.querySelectorAll('.pz-product-card--pizza').forEach((c) => {
        c.classList.remove('selected');
      });
      renderBuilder();
    });
  });

  document.querySelectorAll('[data-showcase-flavor]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedFlavorId = button.dataset.showcaseFlavor;
      selectedDrinkId = null;
      selectedSize = null;
      const flavor = menu.flavors.find((item) => item.id === selectedFlavorId);
      pizzaBuilderFlavors = flavor ? [{ id: flavor.id, name: flavor.name }] : [];
      document.querySelectorAll('.pz-product-card--pizza').forEach((card) => {
        card.classList.toggle('selected', card.dataset.flavorId === selectedFlavorId);
      });
      document.querySelectorAll('.pz-product-card--drink').forEach((card) => card.classList.remove('selected'));
      renderBuilder();
    });
  });

  document.querySelectorAll('[data-favorite-flavor]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const flavorId = button.dataset.favoriteFlavor;
      if (!flavorId) return;
      favoriteFlavors = toggleFavoriteFlavor(flavorId);
      renderApp();
    });
  });

  document.getElementById('reorderBtn')?.addEventListener('click', () => {
    if (!lastOrder || !Array.isArray(lastOrder.items)) return;
    cart = lastOrder.items.map((item) => ({ ...item }));
    deliveryFee = lastOrder.deliveryFee || deliveryFee;
    orderMode = lastOrder.orderMode || orderMode;
    saveCartState();
    const orderModeSelect = document.getElementById('orderModeSelect');
    if (orderModeSelect) orderModeSelect.value = orderMode;
    updateOrderModeUI();
    renderCart();
    showToast('Último pedido carregado na sacola!');
  });

  document.getElementById('orderModeSelect')?.addEventListener('change', (e) => {
    orderMode = e.target.value;
    updateOrderModeUI();
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
  document.getElementById('pzSidebarToggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('pzSupportBtn')?.addEventListener('click', sendSupportWhatsApp);
  document.getElementById('floatingCart')?.addEventListener('click', openCartDrawer);

  document.querySelectorAll('[data-close-cart]').forEach((el) => {
    el.addEventListener('click', closeCartDrawer);
  });

  document.getElementById('cartPanel')?.addEventListener('click', (event) => {
    if (event.target.dataset.closeCart !== undefined) {
      closeCartDrawer();
    }
  });

  document.getElementById('whatsappBtnDrawer')?.addEventListener('click', sendWhatsApp);

}

async function init() {
  menu = await loadMenu();
  if (!menu || (!menu.flavors?.length && !menu.drinks?.length)) {
    renderUnavailable();
    return;
  }
  menu.coupons = menu.coupons || [];
  menu.flavors = menu.flavors || [];
  menu.drinks = menu.drinks || [];
  menu.categories = menu.categories || [];
  menu.neighborhoods = menu.neighborhoods || [];
  favoriteFlavors = getFavoriteFlavors();
  lastOrder = getLastOrder();

  const savedCartState = loadCartState();
  if (savedCartState) {
    cart = Array.isArray(savedCartState.cart) ? savedCartState.cart : [];
    deliveryFee = Number(savedCartState.deliveryFee) || 0;
    orderMode = savedCartState.orderMode || orderMode;
    appliedCoupon = savedCartState.appliedCoupon || null;
    couponMessage = savedCartState.couponMessage || '';
  }

  menuTab = menu.flavors.length ? 'pizza' : 'bebida';
  renderApp();
}

document.addEventListener('DOMContentLoaded', init);
