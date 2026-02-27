document.addEventListener("click", async function (e) {

  /* PRODUCT DETAILS PAGE */
  if (e.target.id === "pd-add-to-cart") {
    e.preventDefault();
    e.stopPropagation();

    const productId = e.target.dataset.productId;
    const sizeBtn = document.querySelector(".weight-btn.active");

    if (!sizeBtn) {
      showToast("Please select a weight", "error");
      return;
    }

    const size = sizeBtn.dataset.size;
    const quantity = document.getElementById("pd-qty").value || 1;

    addItemToCart(productId, size, quantity);
    return; 
  }

  /* HOME PAGE */
  if (e.target.closest(".cake-add-to-cart-btn")) {
    const btn = e.target.closest(".cake-add-to-cart-btn");
    addItemToCart(btn.dataset.productId, btn.dataset.size, btn.dataset.qty);
    return;
  }

  /* SHOP PAGE */
  if (e.target.closest(".add-to-cart-btn")) {
    const btn = e.target.closest(".add-to-cart-btn");
    addItemToCart(btn.dataset.productId, btn.dataset.size, btn.dataset.qty);
    return;
  }

});

/* ------------------ ADD TO CART FUNCTION ------------------ */

async function addItemToCart(productId, size, quantity) {
  try {
    const res = await fetch("/add-to-cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, size, quantity })
    });

    const data = await res.json();

    if (data.success) {
      showToast("Added to cart");
      updateCartCount();

      // REMOVE HEART AFTER ADD TO CART
      document
        .querySelectorAll(`.wishlist-icon[data-product-id="${productId}"]`)
        .forEach(icon => icon.classList.remove("active"));

      updateWishlistCount();
    } else {
      showToast(data.message, "error");
    }

  } catch (err) {
    showToast("Please login to continue.", "error");
  }
}


/* ---------------- UPDATE HEADER CART COUNT ---------------- */

async function updateCartCount() {
  const res = await fetch("/cart-count");
  const data = await res.json();

  const countEl = document.getElementById("cart-count");
  if (countEl) countEl.textContent = data.count;
}
