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
      // item.remove();
      // updateSummary();
      // await updateCartCount();
      
      item.remove();
      // Update summary using backend values
      updateSummaryFromBackend(data.summary);

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
    // Update quantity
qtyEl.textContent = qty;

// Find updated item from backend response
const updatedItem = data.cartItems.find(
  i => i.productId === productId && i.size === size
);

// Update price & subtotal
item.querySelector(".price").textContent = "₹" + updatedItem.price;
item.querySelector(".item-subtotal").textContent = "₹" + updatedItem.subtotal;

// Update summary using backend values
updateSummaryFromBackend(data.summary);
    // qtyEl.textContent = qty;

    // // Update subtotal of this item
    // const subtotalEl = item.querySelector(".item-subtotal");
    // const updatedItem = data.cart.items.find(
    //   i => i.product._id.toString() === productId && i.size === size
    // );

    // subtotalEl.textContent = "₹" + (updatedItem.quantity * updatedItem.priceAtAdd);

    // // Update order summary
    // // updateSummary(data.cart.totalAmount);

    //   updateSummary();


    showToast("Quantity updated");
  }
});


/* ---------------------------------------------------------
    UPDATE SUMMARY (REALTIME TOTALS)
--------------------------------------------------------- */
// function updateSummary(totalAmount = null) {
//   if (totalAmount === null) {
//     // If no data passed, recalc from DOM
//     let sum = 0;
//     document.querySelectorAll(".item-subtotal").forEach(st => {
//       sum += Number(st.textContent.replace("₹", ""));
//     });
//     totalAmount = sum;
//   }

//   document.getElementById("subtotal").textContent = "₹" + totalAmount;
//   document.getElementById("total").textContent = "₹" + totalAmount;
// }

/* ---------------------------------------------------------
   UPDATE SUMMARY (REALTIME TOTALS)
--------------------------------------------------------- */
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

  // const taxRow = document.querySelector(".cart-summary .row:nth-child(2) span:last-child");
  // if (taxRow) taxRow.textContent = "₹" + tax;

  // const shipRow = document.querySelector(".cart-summary .row:nth-child(3) span:last-child");
  // if (shipRow) shipRow.textContent = "₹" + shipping;

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
    msg.className = "warning-text";
    msg.textContent = "⚠ Please remove unavailable items before checkout.";
    checkoutBtn.parentNode.insertBefore(msg, checkoutBtn);
  }
});
