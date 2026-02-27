let selectedProductId = null;
const popup = document.getElementById("weightPopup");

document.addEventListener("click", async (e) => {

  /* =========================================
     ADD TO CART FROM WISHLIST PAGE
  ========================================= */
  const addToCartBtn = e.target.closest(".add-to-cart-btn.from-wishlist");

  if (addToCartBtn && window.location.pathname.includes("/wishlist")) {
    e.preventDefault();

    const productId = addToCartBtn.dataset.productId;
    const size = addToCartBtn.dataset.size;
    const qty = addToCartBtn.dataset.qty;

    try {
      const res = await fetch("/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, size, quantity: qty })
      });

      const data = await res.json();

      if (!data.success) {
        showToast(data.message, "error");
        return;
      }

      // Remove card from UI
      addToCartBtn.closest(".product-card")?.remove();

      // Update page count
      const countEl = document.getElementById("wishlist-page-count");
      if (countEl) {
        countEl.textContent = Math.max(0, Number(countEl.textContent) - 1);
      }

      // Remove from backend wishlist
      await fetch("/wishlist/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, size })
      });

      updateWishlistCount();
      showToast("Added to cart");

    } catch (err) {
      console.error("Cart add failed:", err);
    }

    return;
  }


  /* =========================================
     REMOVE FROM WISHLIST PAGE
  ========================================= */
  const removeBtn = e.target.closest(".remove-from-wishlist");

  if (removeBtn && window.location.pathname.includes("/wishlist")) {
    e.preventDefault();

    const productId = removeBtn.dataset.productId;
    const size = removeBtn.dataset.size;

    await fetch("/wishlist/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, size })
    });

    removeBtn.closest(".product-card")?.remove();

    const countEl = document.getElementById("wishlist-page-count");
    if (countEl) {
      countEl.textContent = Math.max(0, Number(countEl.textContent) - 1);
    }

    updateWishlistCount();
    showToast("Removed from wishlist");

    return;
  }


  /* =========================================
     HEART CLICK (HOME / SHOP)
  ========================================= */

  const heart = e.target.closest(".wishlist-icon");

  if (
    heart &&
    !window.location.pathname.includes("/wishlist") &&
    heart.id !== "pd-wishlist"
  ) {
    e.preventDefault();

    selectedProductId = heart.dataset.productId;

    if (!popup) return;

    // Position popup near clicked heart
    const rect = heart.getBoundingClientRect();

    popup.style.top = window.scrollY + rect.bottom + 6 + "px";
    popup.style.left = window.scrollX + rect.left + "px";

    popup.innerHTML = `
      <button data-size="1kg">1kg</button>
      <button data-size="2kg">2kg</button>
      <button data-size="3kg">3kg</button>
    `;

    popup.style.display = "block";
    return;
  }

  /* =========================================
   HEART CLICK (PRODUCT DETAILS PAGE)
========================================= */

if (heart && window.location.pathname.includes("/product/") && heart.id === "pd-wishlist") {
  e.preventDefault();

  const productId = heart.dataset.productId;

  const activeBtn = document.querySelector(".weight-btn.active");
  if (!activeBtn) return;

  const size = activeBtn.dataset.size;

  const res = await fetch("/wishlist/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, size })
  });

  const data = await res.json();

  if (!data.success) {
    showToast(data.message || "Please login", "error");
    return;
  }

  heart.classList.toggle("active", data.isAdded);

  /* 🔥 UPDATE LOCAL wishlistItems ARRAY */
if (typeof wishlistItems !== "undefined") {

  if (data.isAdded) {
    wishlistItems.push({ product: productId, size });
  } else {
    const index = wishlistItems.findIndex(item =>
      String(item.product) === String(productId) &&
      item.size === size
    );
    if (index > -1) wishlistItems.splice(index, 1);
  }

}

  updateWishlistCount();
  showToast(data.message);

  return;
}


  /* =========================================
     WEIGHT SELECT FROM POPUP
  ========================================= */

  const weightBtn = e.target.closest("#weightPopup button");

  if (weightBtn && selectedProductId) {

    const size = weightBtn.dataset.size;

    const res = await fetch("/wishlist/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: selectedProductId,
        size
      })
    });

    const data = await res.json();

    //if user not logged in or any failure
    if (!data.success) {
      showToast(data.message || "Please login to continue", "error");

      if (popup) popup.style.display = "none";
      selectedProductId = null;
      return;
    }

/*  SUCCESS */
    document
      .querySelectorAll(
        `.wishlist-icon[data-product-id="${selectedProductId}"]`
      )
      .forEach(icon =>
        icon.classList.toggle("active", data.isAdded)
      );

    updateWishlistCount();
    showToast(data.message);

    if (popup) popup.style.display = "none";
    selectedProductId = null;
    return;
  }


  /* =========================================
     CLICK OUTSIDE → CLOSE POPUP
  ========================================= */

  if (
    popup &&
    !e.target.closest("#weightPopup") &&
    !e.target.closest(".wishlist-icon")
  ) {
    popup.style.display = "none";
    selectedProductId = null;
  }

});


/* =========================================
   UPDATE HEADER COUNT
========================================= */
async function updateWishlistCount() {
  try {
    const res = await fetch("/wishlist-count");
    const data = await res.json();
    const el = document.getElementById("wishlist-count");
    if (el) el.textContent = data.count;
  } catch {}
}

document.addEventListener("DOMContentLoaded", updateWishlistCount);