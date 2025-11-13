document.addEventListener("click", async (e) => {

  const item = e.target.closest(".cart-item");
  if (!item) return;

  const productId = item.dataset.id;
  const size = item.dataset.size;

  /* ----------- REMOVE ITEM ----------- */
  if (e.target.classList.contains("remove-btn")) {
    const res = await fetch("/cart/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, size })
    });

    const data = await res.json();
    if (data.success) {
      item.remove();
      showToast("Item removed");
      location.reload();
    }
  }

  /* ----------- UPDATE QTY ----------- */
  if (e.target.classList.contains("plus") || e.target.classList.contains("minus")) {

    const qtyEl = item.querySelector(".qty-display");
    let qty = Number(qtyEl.textContent);

    if (e.target.classList.contains("plus")) qty++;
    else qty = Math.max(1, qty - 1);

    const res = await fetch("/cart/update-qty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, size, quantity: qty })
    });

    const data = await res.json();
    if (data.success) {
      qtyEl.textContent = qty;

      const subtotalEl = item.querySelector(".item-subtotal");
      const newItem = data.cart.items.find(
        i => i.product === productId && i.size === size
      );

      subtotalEl.textContent = "₹" + (newItem.quantity * newItem.priceAtAdd);
      document.getElementById("subtotal").textContent = "₹" + data.cart.totalAmount;
      document.getElementById("total").textContent = "₹" + data.cart.totalAmount;

      showToast("Quantity updated");
    } else {
      showToast(data.message, "error");
    }
  }
});
