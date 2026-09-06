/* ===========================================================
   Manglee — shared script.js
   Handles: product listing + filter (product.html)
            order form autofill + submit (order.html)
            admin order table from CSV (admin.html)
=========================================================== */

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyT01Q9dQSFOanvVumfGHRdWeFoPjMWFvqcPLd5G0-R3O-drW-DkSjf0GUDNdttkFlE/exec";
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlx8uknkhA0CRxaGYQ3bPLRPwdxRIfUL72rhx1-X8IrIjxoRpEr381bmt4jPOBh6Wdj8y1o0dflsCa/pub?output=csv";

const DESIGN_LABELS = {
  all: "ทั้งหมด",
  sweetbear: "Sweet Bear",
  blossom: "Blossom",
  cutietype: "Cutie Type",
};

/* ---------------------------------------------------------
   product.html — load products, render cards, filter by mood
--------------------------------------------------------- */

async function initProductPage() {
  const listEl = document.getElementById("product-list");
  const filterEl = document.getElementById("filter-bar");
  if (!listEl || !filterEl) return;

  let products = [];
  try {
    const res = await fetch("products.json");
    products = await res.json();
  } catch (err) {
    listEl.innerHTML = '<p class="empty-state">โหลดข้อมูลสินค้าไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const initialDesign = params.get("mood") || params.get("design") || "all";

  const designs = ["all", ...new Set(products.map((p) => p.design))];
  filterEl.innerHTML = designs
    .map(
      (d) =>
        `<button class="filter-btn${d === initialDesign ? " active" : ""}" data-design="${d}">${DESIGN_LABELS[d] || d}</button>`
    )
    .join("");

  function renderList(design) {
    const filtered = design === "all" ? products : products.filter((p) => p.design === design);

    if (filtered.length === 0) {
      listEl.innerHTML = '<p class="empty-state">ยังไม่มีสินค้าในหมวดนี้</p>';
      return;
    }

    listEl.innerHTML = filtered
      .map((p) => {
        const fullName = `${p.designName} (${p.colorName})`;
        const orderUrl = `order.html?item=${encodeURIComponent(fullName)}&price=${p.price}`;
        return `
          <div class="product-card">
            <img src="${p.image}" alt="${fullName}" loading="lazy">
            <div class="product-body">
              <div class="product-name">${p.designName}</div>
              <div class="color-chip-row">
                <span class="color-chip ${p.color}"></span>
                <span>${p.colorName}</span>
              </div>
              <p class="product-desc">${p.description}</p>
              <div class="product-price">฿${p.price}</div>
              <a class="order-link" href="${orderUrl}">สั่งซื้อ</a>
            </div>
          </div>
        `;
      })
      .join("");
  }

  filterEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    filterEl.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderList(btn.dataset.design);
  });

  renderList(initialDesign);
}

/* ---------------------------------------------------------
   order.html — autofill item/price from URL, submit order
--------------------------------------------------------- */

function initOrderPage() {
  const form = document.getElementById("orderForm");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const itemsField = document.getElementById("items");
  const totalField = document.getElementById("total");

  const itemParam = params.get("item");
  const priceParam = params.get("price");

  if (itemParam && itemsField) {
    itemsField.value = decodeURIComponent(itemParam);
  }
  if (priceParam && totalField) {
    totalField.value = priceParam;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const sizeField = document.getElementById("size");

    let itemsValue = itemsField.value;
    if (sizeField && sizeField.value) {
      itemsValue = `${itemsValue} ไซส์ ${sizeField.value}`;
    }

    const payload = {
      customerName: document.getElementById("customerName").value,
      contact: document.getElementById("contact").value,
      items: itemsValue,
      total: totalField.value,
      note: document.getElementById("note").value,
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "กำลังส่งคำสั่งซื้อ...";
    }

    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    })
      .then(() => {
        window.location.href = "thankyou.html";
      })
      .catch((error) => {
        console.error(error);
        alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "ยืนยันสั่งซื้อ";
        }
      });
  });
}

/* ---------------------------------------------------------
   admin.html — load orders from published CSV, render table
--------------------------------------------------------- */

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && next === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

async function initAdminPage() {
  const tableBody = document.querySelector("#ordersTable tbody");
  if (!tableBody) return;

  try {
    const res = await fetch(CSV_URL);
    const text = await res.text();
    const rows = parseCSV(text);

    const dataRows = rows.slice(1).reverse();

    if (dataRows.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="admin-empty">ยังไม่มีคำสั่งซื้อเข้ามา</td></tr>';
      return;
    }

    tableBody.innerHTML = dataRows
      .map(
        (r) => `
          <tr>
            <td>${r[0] || ""}</td>
            <td>${r[1] || ""}</td>
            <td>${r[2] || ""}</td>
            <td>${r[3] || ""}</td>
            <td>${r[4] || ""}</td>
            <td>${r[5] || ""}</td>
          </tr>
        `
      )
      .join("");
  } catch (err) {
    tableBody.innerHTML = '<tr><td colspan="6" class="admin-empty">โหลดข้อมูลออเดอร์ไม่สำเร็จ ลองรีเฟรชอีกครั้ง</td></tr>';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
