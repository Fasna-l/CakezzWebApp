document.addEventListener("click", async (e) => {
  const item = e.target.closest(".cart-item");
  if (!item) return;

  const productId = item.dataset.id;
  const size = item.dataset.size;

  /* ---------------- REMOVE ITEM ---------------- */
  if (e.target.classList.contains("remove-btn")) {
    const res = await fetch("/cart/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, size })
    });

    const data = await res.json();
    if (data.success) {
      item.remove();
      updateSummary();
      await updateCartCount();
      showToast("Item removed");
    } else {
      showToast(data.message, "error");
    }
    return;
  }

  /* ---------------- UPDATE QUANTITY ---------------- */
  if (e.target.classList.contains("plus") || e.target.classList.contains("minus")) {
    const qtyEl = item.querySelector(".qty-display");
    let qty = Number(qtyEl.textContent);

    // Apply frontend max limit (max 5 per item)
    if (e.target.classList.contains("plus")) {
      if (qty >= 5) {
        showToast("Maximum 5 per item allowed.", "error");
        return;
      }
      qty++;
    } else {
      qty = Math.max(1, qty - 1);
    }

    const res = await fetch("/cart/update-qty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, size, quantity: qty })
    });

    const data = await res.json();

    if (!data.success) {
      showToast(data.message, "error");
      return;
    }

    // Update quantity visually
    qtyEl.textContent = qty;

    // Update subtotal of this item
    const subtotalEl = item.querySelector(".item-subtotal");
    const updatedItem = data.cart.items.find(
      i => i.product._id.toString() === productId && i.size === size
    );

    subtotalEl.textContent = "₹" + (updatedItem.quantity * updatedItem.priceAtAdd);

    // Update order summary
    updateSummary(data.cart.totalAmount);

    showToast("Quantity updated");
  }
});


/* ---------------------------------------------------------
    UPDATE SUMMARY (REALTIME TOTALS)
--------------------------------------------------------- */
function updateSummary(totalAmount = null) {
  if (totalAmount === null) {
    // If no data passed, recalc from DOM
    let sum = 0;
    document.querySelectorAll(".item-subtotal").forEach(st => {
      sum += Number(st.textContent.replace("₹", ""));
    });
    totalAmount = sum;
  }

  document.getElementById("subtotal").textContent = "₹" + totalAmount;
  document.getElementById("total").textContent = "₹" + totalAmount;
}


//Disable checkout when invalid items exist
window.addEventListener("DOMContentLoaded", () => {
  const checkoutBtn = document.querySelector(".checkout-btn");
  const items = document.querySelectorAll(".cart-item");

  let hasError = false;

  items.forEach(i => {
    if (i.dataset.unavailable === "true" || i.dataset.outofstock === "true") {
      hasError = true;
    }
  });

  if (hasError) {
    checkoutBtn.disabled = true;
    checkoutBtn.classList.add("disabled-btn");

    const msg = document.createElement("p");
    msg.className = "warning-text";
    msg.textContent = "⚠ Please remove unavailable items before checkout.";
    checkoutBtn.parentNode.insertBefore(msg, checkoutBtn);
  }
});
