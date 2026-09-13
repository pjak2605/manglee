/* ===========================================================
   Manglee POS — pos.js
   Loads variant stock from Supabase, manages an in-memory cart,
   and checks out via the checkout_sale() Postgres function.
=========================================================== */

let allProducts = [];
let cart = []; // { id, design_name, color_name, size, price, qty, stockAtLoad }

function imageFor(design, color) {
  return `images/${design}-${color}.jpg`;
}

function cartQtyFor(productId) {
  const line = cart.find((c) => c.id === productId);
  return line ? line.qty : 0;
}

async function loadProducts() {
  const grid = document.getElementById("pos-products");
  grid.innerHTML = '<p class="cart-empty">กำลังโหลดสินค้า...</p>';

  const { data, error } = await sb.from("products").select("*").order("id");

  if (error) {
    grid.innerHTML = '<p class="cart-empty">โหลดสินค้าไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p>';
    console.error(error);
    return;
  }

  allProducts = data;
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById("pos-products");

  const groups = {};
  allProducts.forEach((p) => {
    const key = `${p.design}-${p.color}`;
    if (!groups[key]) {
      groups[key] = {
        design: p.design,
        designName: p.design_name,
        color: p.color,
        colorName: p.color_name,
        price: p.price,
        sizes: [],
      };
    }
    groups[key].sizes.push(p);
  });

  const sizeOrder = { S: 0, M: 1, L: 2, XL: 3 };

  grid.innerHTML = Object.values(groups)
    .map((g) => {
      g.sizes.sort((a, b) => sizeOrder[a.size] - sizeOrder[b.size]);
      const sizeButtons = g.sizes
        .map((p) => {
          const inCart = cartQtyFor(p.id);
          const remaining = p.stock - inCart;
          const disabled = remaining <= 0 ? "disabled" : "";
          return `
            <button class="size-btn" ${disabled} data-id="${p.id}">
              <span>${p.size}</span>
              <span class="stock-count">เหลือ ${remaining}</span>
            </button>
          `;
        })
        .join("");

      return `
        <div class="pos-card">
          <img src="${imageFor(g.design, g.color)}" alt="${g.designName} ${g.colorName}" loading="lazy">
          <div class="pos-card-body">
            <div class="pos-card-name">${g.designName} (${g.colorName})</div>
            <div class="pos-card-price">฿${g.price}</div>
            <div class="size-btn-row">${sizeButtons}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function addToCart(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return;

  const existing = cart.find((c) => c.id === productId);
  const currentQty = existing ? existing.qty : 0;

  if (currentQty + 1 > product.stock) return;

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: product.id,
      design_name: product.design_name,
      color_name: product.color_name,
      size: product.size,
      price: product.price,
      qty: 1,
      stockAtLoad: product.stock,
    });
  }

  renderProducts();
  renderCart();
}

function changeQty(productId, delta) {
  const line = cart.find((c) => c.id === productId);
  if (!line) return;

  const product = allProducts.find((p) => p.id === productId);
  const newQty = line.qty + delta;

  if (newQty <= 0) {
    cart = cart.filter((c) => c.id !== productId);
  } else if (product && newQty <= product.stock) {
    line.qty = newQty;
  }

  renderProducts();
  renderCart();
}

function renderCart() {
  const cartEl = document.getElementById("cart-lines");
  const totalEl = document.getElementById("cart-total");
  const checkoutBtn = document.getElementById("checkoutBtn");

  if (cart.length === 0) {
    cartEl.innerHTML = '<p class="cart-empty">ยังไม่มีสินค้าในตะกร้า</p>';
    totalEl.textContent = "฿0";
    checkoutBtn.disabled = true;
    return;
  }

  cartEl.innerHTML = cart
    .map(
      (c) => `
        <div class="cart-line">
          <div class="cart-line-info">
            <div>${c.design_name} (${c.color_name}) — ไซส์ ${c.size}</div>
            <div class="cart-sub">฿${c.price} × ${c.qty} = ฿${c.price * c.qty}</div>
          </div>
          <div class="qty-controls">
            <button data-action="dec" data-id="${c.id}">−</button>
            <span>${c.qty}</span>
            <button data-action="inc" data-id="${c.id}">+</button>
          </div>
        </div>
      `
    )
    .join("");

  const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  totalEl.textContent = `฿${total}`;
  checkoutBtn.disabled = false;
}

async function checkout() {
  const checkoutBtn = document.getElementById("checkoutBtn");
  const messageEl = document.getElementById("pos-message");

  if (cart.length === 0) return;

  const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const items = cart.map((c) => ({
    product_id: c.id,
    design_name: c.design_name,
    color_name: c.color_name,
    size: c.size,
    qty: c.qty,
    price: c.price,
  }));

  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "กำลังบันทึก...";
  messageEl.innerHTML = "";

  const { data, error } = await sb.rpc("checkout_sale", { items, total });

  checkoutBtn.textContent = "ชำระเงิน";

  if (error) {
    console.error(error);
    messageEl.innerHTML = `<div class="pos-message error">บันทึกการขายไม่สำเร็จ: ${error.message}</div>`;
    checkoutBtn.disabled = false;
    return;
  }

  messageEl.innerHTML = `<div class="pos-message success">บันทึกการขายสำเร็จ (บิลเลขที่ ${data}) ยอดรวม ฿${total}</div>`;
  cart = [];
  await loadProducts();
  renderCart();
}

document.addEventListener("DOMContentLoaded", () => {
  const productsGrid = document.getElementById("pos-products");
  if (!productsGrid) return;

  loadProducts();
  renderCart();

  productsGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".size-btn");
    if (!btn || btn.disabled) return;
    addToCart(Number(btn.dataset.id));
  });

  document.getElementById("cart-lines").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const delta = btn.dataset.action === "inc" ? 1 : -1;
    changeQty(Number(btn.dataset.id), delta);
  });

  document.getElementById("checkoutBtn").addEventListener("click", checkout);
});
