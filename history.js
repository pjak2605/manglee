/* ===========================================================
   Manglee POS — history.js
   Loads sales + sale_items from Supabase and renders them.
=========================================================== */

async function loadHistory() {
  const listEl = document.getElementById("history-list");
  if (!listEl) return;

  listEl.innerHTML = '<p class="cart-empty">กำลังโหลดประวัติการขาย...</p>';

  const { data, error } = await sb
    .from("sales")
    .select("id, created_at, total, sale_items(design_name, color_name, size, qty, price)")
    .order("created_at", { ascending: false });

  if (error) {
    listEl.innerHTML = '<p class="cart-empty">โหลดประวัติการขายไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p>';
    console.error(error);
    return;
  }

  if (data.length === 0) {
    listEl.innerHTML = '<p class="cart-empty">ยังไม่มีประวัติการขาย</p>';
    return;
  }

  listEl.innerHTML = data
    .map((sale) => {
      const time = new Date(sale.created_at).toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
      });

      const items = (sale.sale_items || [])
        .map(
          (item) => `
            <div class="item-row">
              <span>${item.design_name} (${item.color_name}) ไซส์ ${item.size} × ${item.qty}</span>
              <span>฿${item.price * item.qty}</span>
            </div>
          `
        )
        .join("");

      return `
        <div class="sale-card">
          <div class="sale-card-head">
            <span class="sale-time">บิลเลขที่ ${sale.id} · ${time}</span>
            <span class="sale-total">฿${sale.total}</span>
          </div>
          <div class="sale-items-list">${items}</div>
        </div>
      `;
    })
    .join("");
}

document.addEventListener("DOMContentLoaded", loadHistory);
