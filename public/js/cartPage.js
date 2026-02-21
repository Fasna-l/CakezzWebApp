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
      // Update summary using backend values
      updateSummaryFromBackend(data.summary);

      await updateCartCount();
      evaluateCheckoutButton();
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

  //reload cart to re-evaluate stock correctly
  window.location.reload();
  }
});

//UPDATE SUMMARY (REALTIME TOTALS)
function updateSummary() {

  // 1) Recalculate subtotal from individual item subtotals
  let subtotal = 0;
  document.querySelectorAll(".item-subtotal").forEach(st => {
    subtotal += Number(st.textContent.replace("₹", ""));
  });
  // 2) TAX (5%)
  const tax = Math.round(subtotal * 0.05);
  // 3) SHIPPING (always ₹50)
  const shipping = 50;
  // 4) GRAND TOTAL
  const grandTotal = subtotal + tax + shipping;
  // 5) Update DOM elements
  document.getElementById("subtotal").textContent = "₹" + subtotal;
  document.getElementById("tax").textContent = "₹" + tax;
  document.getElementById("shipping").textContent = "₹" + shipping;
  document.getElementById("total").textContent = "₹" + grandTotal;
}

function updateSummaryFromBackend(summary) {
  document.getElementById("subtotal").textContent = "₹" + summary.subtotal;
  document.getElementById("tax").textContent = "₹" + summary.tax;
  document.getElementById("shipping").textContent = "₹" + summary.shipping;
  document.getElementById("total").textContent = "₹" + summary.total;
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
    msg.className = "warning-text cart-warning";
    msg.textContent = "⚠ Please remove unavailable items before checkout.";
    checkoutBtn.parentNode.insertBefore(msg, checkoutBtn);
  }


  evaluateCheckoutButton();

});

// CHECKOUT BUTTON ENABLE/DISABLE LOGIC
function evaluateCheckoutButton() {
  const checkoutBtn = document.querySelector(".checkout-btn");
  const items = document.querySelectorAll(".cart-item");
  const warning = document.querySelector(".warning-text.cart-warning");

  if (!checkoutBtn) return;

  let hasUnavailable = false;
  let hasStockIssue = false;

  items.forEach(i=>{
    if(i.dataset.unavailable === "true"){
      hasUnavailable = true;
    }
    
    if(i.dataset.outofstock === "true" || i.dataset.insufficientstock === "true"){
      hasStockIssue = true;
    }
  })
  // If no items
  if (items.length === 0) {
    checkoutBtn.disabled = true;
    checkoutBtn.classList.add("disabled-btn");
    if (warning) warning.remove();
    return;
  }

  if(hasUnavailable || hasStockIssue){
    checkoutBtn.disabled = true;
    checkoutBtn.classList.add("disabled-btn");
    // If warning doesn't exist, add it
    if (!warning) {
      const msg = document.createElement("p");
      msg.className = "warning-text cart-warning";
      if (hasUnavailable){
        msg.textContent = "⚠ Please remove unavailable items before checkout.";
      } else {
        msg.textContent = "⚠ Please fix stock issue before checkout."
      }
      checkoutBtn.parentNode.insertBefore(msg, checkoutBtn);
    }

  } else {
    checkoutBtn.disabled = false;
    checkoutBtn.classList.remove("disabled-btn");

    // Remove existing warning
    if (warning) warning.remove();
  }
}
