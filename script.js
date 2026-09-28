// ==========================================
// FBI BITES: PRODUCT DATA + CART LOGIC
// ==========================================

const MPESA_NUMBER = "0790569032";
const WHATSAPP_NUMBER = "254790569032";
const DELIVERY_FEE = 150;

const products = window.FBI_PRODUCTS;

const cart = [];
let activeCategory = "All";
let searchTerm = "";

const categoryIcons = {
  Ndakava: "🌭",
  "Chapati Meals": "🫓",
  Chicken: "🍗",
  Meat: "🍖",
  Snacks: "🥚",
  Fries: "🍟",
  "Quick Bites": "🥪",
  Meals: "🍽️",
  Drinks: "🥤",
};
const categoryOrder = ["Ndakava", "Chapati Meals", "Chicken", "Meat", "Snacks", "Fries", "Quick Bites", "Meals", "Drinks"];
const pageNames = new Set(["home", "menu", "about", "how-it-works", "contact"]);

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  currencyDisplay: "code",
  maximumFractionDigits: 0,
});

function formatCurrency(value) {
  return currency.format(value);
}

function formatProductPrice(value) {
  return Number.isFinite(value) && value > 0 ? formatCurrency(value) : "Price coming soon";
}

function getProductById(productId) {
  return products.find((product) => product.id === Number(productId));
}

function getCartCount() {
  return cart.reduce((total, item) => total + item.quantity, 0);
}

function getSubtotal() {
  return cart.reduce((total, item) => total + item.quantity * item.price, 0);
}

function getDeliveryFee() {
  return cart.length > 0 ? DELIVERY_FEE : 0;
}

function getGrandTotal() {
  return getSubtotal() + getDeliveryFee();
}

function addToCart(productId, sourceButton) {
  const product = getProductById(productId);

  if (!product || !product.available || !Number.isFinite(product.price) || product.price <= 0) {
    return;
  }

  const existingItem = cart.find((item) => item.id === product.id);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
    });
  }

  renderCart();
  openCart();
  document.querySelector(".cart-button")?.classList.remove("count-bump");
  requestAnimationFrame(() => document.querySelector(".cart-button")?.classList.add("count-bump"));

  const button = sourceButton || document.querySelector(`.product-card [data-product-id="${product.id}"]`);
  if (button) {
    const previousLabel = button.dataset.defaultLabel || "ADD TO CART";
    button.textContent = "Added ✓";
    button.classList.add("is-added");
    setTimeout(() => {
      button.textContent = previousLabel;
      button.classList.remove("is-added");
    }, 650);
  }
}

function updateQuantity(productId, change) {
  const item = cart.find((cartItem) => cartItem.id === Number(productId));

  if (!item) {
    return;
  }

  item.quantity += change;

  if (item.quantity <= 0) {
    const index = cart.findIndex((cartItem) => cartItem.id === Number(productId));
    cart.splice(index, 1);
  }

  renderCart();
}

function renderCart() {
  const badge = document.querySelector(".cart-button small");
  const subtotalNode = document.getElementById("cartSubtotal");
  const deliveryNode = document.getElementById("cartDelivery");
  const totalNode = document.getElementById("cartTotal");
  const cartItemsContainer = document.getElementById("cartItems");
  const emptyState = document.getElementById("cartEmptyState");
  const estimateNote = document.getElementById("cartEstimateNote");
  const checkoutButton = document.getElementById("checkoutButton");
  const whatsappButton = document.getElementById("whatsappCheckout");
  const mpesaButton = document.getElementById("mpesaCheckout");

  if (badge) {
    badge.textContent = String(getCartCount());
  }

  document.querySelector(".cart-button")?.setAttribute(
    "aria-label",
    `View cart, ${getCartCount()} ${getCartCount() === 1 ? "item" : "items"}`
  );

  if (subtotalNode) {
    subtotalNode.textContent = formatCurrency(getSubtotal());
  }

  if (deliveryNode) {
    deliveryNode.textContent = formatCurrency(getDeliveryFee());
  }

  if (totalNode) {
    totalNode.textContent = formatCurrency(getGrandTotal());
  }

  if (estimateNote) {
    estimateNote.hidden = !cart.some((item) => getProductById(item.id)?.priceIsEstimate);
  }

  if (!cartItemsContainer || !emptyState || !checkoutButton || !whatsappButton || !mpesaButton) {
    return;
  }

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = "";
    emptyState.style.display = "block";
    checkoutButton.disabled = true;
    whatsappButton.disabled = true;
    mpesaButton.disabled = true;
    return;
  }

  emptyState.style.display = "none";
  cartItemsContainer.innerHTML = cart
    .map(
      (item) => `
          <div class="cart-item" data-id="${item.id}">
          <div class="cart-item-copy">
            <strong>${item.name}</strong>
              <small>${formatCurrency(item.price)} each</small>
          </div>
          <div class="cart-item-actions">
            <button class="qty-btn" data-action="decrease" data-id="${item.id}" type="button">−</button>
            <span>${item.quantity}</span>
            <button class="qty-btn" data-action="increase" data-id="${item.id}" type="button">+</button>
          </div>
        </div>
      `
    )
    .join("");

  checkoutButton.disabled = false;
  whatsappButton.disabled = false;
  mpesaButton.disabled = false;
}

function openCart() {
  const cartPanel = document.getElementById("cartPanel");
  const overlay = document.getElementById("cartOverlay");

  if (cartPanel) cartPanel.classList.add("open");
  if (overlay) overlay.classList.add("visible");
}

function closeCart() {
  const cartPanel = document.getElementById("cartPanel");
  const overlay = document.getElementById("cartOverlay");

  if (cartPanel) cartPanel.classList.remove("open");
  if (overlay) overlay.classList.remove("visible");
}

function setMobileMenu(isOpen) {
  document.querySelector(".navbar")?.classList.toggle("menu-open", isOpen);
  document.querySelector(".menu-toggle")?.setAttribute("aria-expanded", String(isOpen));
  document.querySelector(".menu-toggle")?.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
}

function showPage(pageName, updateHistory = true) {
  if (!pageNames.has(pageName)) return;

  document.querySelectorAll(".page-view").forEach((page) => {
    const isActive = page.dataset.page === pageName;
    page.hidden = !isActive;
    page.classList.toggle("is-active", isActive);
  });

  document.querySelectorAll("[data-page-link]").forEach((link) => {
    if (link.dataset.pageLink === pageName) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  setMobileMenu(false);

  if (updateHistory && window.location?.hash !== `#${pageName}`) {
    window.history.pushState({ page: pageName }, "", `#${pageName}`);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildWhatsAppMessage() {
  const name = document.getElementById("customerName")?.value?.trim() || "Customer";
  const location = document.getElementById("customerLocation")?.value?.trim() || "Not specified";
  const note = document.getElementById("customerNote")?.value?.trim() || "No special instructions";

  const items = cart
    .map((item) => `${item.quantity}x ${item.name} - ${formatCurrency(item.quantity * item.price)}`)
    .join("\n");

  const lines = [
    "Hello FBI Bites, I'd like to place this order:",
    "",
    items,
    "",
    `Customer: ${name}`,
    `Location: ${location}`,
    `Notes: ${note}`,
    "",
    `Subtotal: ${formatCurrency(getSubtotal())}`,
    `Delivery: ${formatCurrency(getDeliveryFee())}`,
    `Total: ${formatCurrency(getGrandTotal())}`,
    "",
    ...(cart.some((item) => getProductById(item.id)?.priceIsEstimate)
      ? ["Some item prices are estimates; please confirm the final amount before preparing the order.", ""]
      : []),
    "Please confirm my order and tell me the delivery time.",
  ];

  return encodeURIComponent(lines.join("\n"));
}

function checkoutViaWhatsApp() {
  if (cart.length === 0) return;

  const message = buildWhatsAppMessage();
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank");
}

function checkoutViaMpesa() {
  if (cart.length === 0) return;

  const amount = getGrandTotal();
  const customerName = document.getElementById("customerName")?.value?.trim() || "Customer";
  const location = document.getElementById("customerLocation")?.value?.trim() || "Not specified";
  const orderSummary = cart.map((item) => `${item.quantity}x ${item.name}`).join(", ");

  const message = encodeURIComponent(
    `Hello FBI Bites, my name is ${customerName}. I want to pay ${formatCurrency(amount)} via M-Pesa to ${MPESA_NUMBER}. My location is ${location}. My order is: ${orderSummary}. Please confirm. Thank you.`
  );

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank");
}

function renderProducts() {
  const menuGrid = document.getElementById("menuGrid");
  const featuredGrid = document.getElementById("featuredGrid");
  if (!menuGrid) return;

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
  const matchesSearch = (product) =>
    !normalizedSearch ||
    `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase().includes(normalizedSearch);
  const menuProducts = products.filter(
    (product) => (activeCategory === "All" || product.category === activeCategory) && matchesSearch(product)
  );
  const featuredProducts = products.filter((product) => product.featured && product.available);

  menuGrid.innerHTML = menuProducts.map(renderProductCard).join("");
  if (featuredGrid) featuredGrid.innerHTML = featuredProducts.map(renderProductCard).join("");
  document.getElementById("menuNoResults")?.toggleAttribute("hidden", menuProducts.length > 0);
}

function renderProductCard(product) {
  const canOrder = product.available && Number.isFinite(product.price) && product.price > 0;
  const actionLabel = !product.available ? "Currently unavailable" : canOrder ? "ADD TO CART" : "COMING SOON";
  const imageMarkup = product.image
    ? `<img class="product-photo" src="${product.image}" alt="${product.name}" data-placeholder-icon="${categoryIcons[product.category] || "🍴"}" loading="lazy" />`
    : `<div class="product-image-placeholder" aria-label="${product.category} image coming soon"><span>${categoryIcons[product.category] || "🍴"}</span><small>FBI BITES</small></div>`;

  return `
    <article class="product-card ${product.featured ? "featured-product" : ""} ${product.available ? "" : "unavailable-product"}">
      <div class="product-image">
        ${product.featured ? '<span class="product-label">FEATURED</span>' : ""}
        ${imageMarkup}
        <button class="favorite" type="button" aria-label="Favourite ${product.name}">♡</button>
      </div>
      <div class="product-info">
        <div class="product-category">${product.category.toUpperCase()}</div>
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="product-bottom">
          <strong class="price">${product.available ? formatProductPrice(product.price) : "Currently unavailable"}${product.priceIsEstimate && product.available ? '<small class="price-estimate">ESTIMATE</small>' : ""}</strong>
          <button class="add-button ${canOrder ? "" : "is-disabled"}" type="button" data-product-id="${product.id}" data-default-label="${actionLabel}" aria-label="${actionLabel} ${product.name}" ${canOrder ? "" : "disabled"}>${actionLabel}</button>
        </div>
      </div>
    </article>
  `;
}

function renderCategoryControls() {
  const categories = [...new Set([...categoryOrder, ...products.map((product) => product.category)])];
  const filters = ["All", ...categories];
  const filterMarkup = filters
    .map((category) => `<button class="filter-btn ${category === activeCategory ? "active" : ""}" type="button" data-filter="${category}">${category}</button>`)
    .join("");
  const tileMarkup = filters
    .map((category) => {
      const icon = category === "All" ? "🔥" : categoryIcons[category] || "🍴";
      const count = category === "All" ? products.length : products.filter((product) => product.category === category).length;
      return `<button class="category-card ${category === activeCategory ? "active" : ""}" type="button" data-category-filter="${category}"><div class="category-icon">${icon}</div><div><h3>${category}</h3><p>${count} ${count === 1 ? "bite" : "bites"}</p></div><span class="category-arrow">→</span></button>`;
    })
    .join("");

  const filtersContainer = document.getElementById("menuFilters");
  const tilesContainer = document.getElementById("categoryTiles");
  if (filtersContainer) filtersContainer.innerHTML = filterMarkup;
  if (tilesContainer) tilesContainer.innerHTML = tileMarkup;
}

function setCategory(category) {
  activeCategory = category;
  renderCategoryControls();
  renderProducts();
}

function attachEvents() {
  document.querySelector(".cart-button")?.addEventListener("click", openCart);
  document.getElementById("cartClose")?.addEventListener("click", closeCart);
  document.getElementById("cartOverlay")?.addEventListener("click", closeCart);
  document.getElementById("checkoutButton")?.addEventListener("click", checkoutViaWhatsApp);
  document.getElementById("whatsappCheckout")?.addEventListener("click", checkoutViaWhatsApp);
  document.getElementById("mpesaCheckout")?.addEventListener("click", checkoutViaMpesa);
  document.querySelector(".quick-add")?.addEventListener("click", () => {
    const featuredProduct = products.find((product) => product.featured && product.available);
    if (featuredProduct) addToCart(featuredProduct.id);
  });
  document.querySelector(".menu-toggle")?.addEventListener("click", () => {
    const navbar = document.querySelector(".navbar");
    setMobileMenu(!navbar?.classList.contains("menu-open"));
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;

    const target = link.getAttribute("href").slice(1);
    if (link.hasAttribute("data-open-cart") || target === "cart") {
      event.preventDefault();
      openCart();
      setMobileMenu(false);
      return;
    }

    if (pageNames.has(target)) {
      event.preventDefault();
      showPage(target);
    }
  });

  window.addEventListener("popstate", () => {
    const requestedPage = window.location.hash.slice(1);
    showPage(pageNames.has(requestedPage) ? requestedPage : "home", false);
  });

  document.getElementById("menuSearch")?.addEventListener("input", (event) => {
    searchTerm = event.currentTarget.value;
    renderProducts();
  });

  document.getElementById("menuGrid")?.addEventListener("click", (event) => {
    const addButton = event.target.closest(".add-button:not(:disabled)");
    if (addButton) addToCart(addButton.dataset.productId, addButton);
  });

  [document.getElementById("menuGrid"), document.getElementById("featuredGrid")].forEach((grid) => {
    grid?.addEventListener("error", (event) => {
      const image = event.target.closest("img.product-photo");
      if (!image) return;

      const placeholder = document.createElement("div");
      placeholder.className = "product-image-placeholder";
      placeholder.setAttribute("aria-label", `${image.alt} image coming soon`);
      placeholder.innerHTML = `<span>${image.dataset.placeholderIcon || "🍴"}</span><small>IMAGE COMING SOON</small>`;
      image.replaceWith(placeholder);
    }, true);
  });

  document.getElementById("featuredGrid")?.addEventListener("click", (event) => {
    const addButton = event.target.closest(".add-button:not(:disabled)");
    if (addButton) addToCart(addButton.dataset.productId, addButton);
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".qty-btn");
    if (!button) return;

    const { id, action } = button.dataset;
    if (action === "increase") updateQuantity(id, 1);
    if (action === "decrease") updateQuantity(id, -1);
  });

  document.addEventListener("click", (event) => {
    const filterButton = event.target.closest(".filter-btn");
    if (!filterButton) return;
    setCategory(filterButton.dataset.filter);
  });

  document.addEventListener("click", (event) => {
    const categoryTile = event.target.closest(".category-card");
    if (!categoryTile) return;
    setCategory(categoryTile.dataset.categoryFilter);
    showPage("menu");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCart();
      setMobileMenu(false);
    }
  });
}

function init() {
  const requestedPage = window.location?.hash.slice(1);
  showPage(pageNames.has(requestedPage) ? requestedPage : "home", false);
  renderCategoryControls();
  renderProducts();
  renderCart();
  attachEvents();
}

window.addEventListener("DOMContentLoaded", init);