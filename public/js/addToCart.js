document.addEventListener("click", async function (e) {

  /* PRODUCT DETAILS PAGE */
  if (e.target.id === "pd-add-to-cart") {
    const productId = e.target.dataset.productId;
    const size = document.querySelector(".weight-btn.active").dataset.size;
    const quantity = document.getElementById("pd-qty").value;

    addItemToCart(productId, size, quantity);
  }

  /* HOME PAGE — Latest Products / Best Sellers */
  if (e.target.closest(".cake-add-to-cart-btn")) {
    const btn = e.target.closest(".cake-add-to-cart-btn");
    addItemToCart(btn.dataset.productId, btn.dataset.size, btn.dataset.qty);
  }

  /* SHOP PAGE */
  if (e.target.closest(".add-to-cart-btn")) {
    const btn = e.target.closest(".add-to-cart-btn");
    addItemToCart(btn.dataset.productId, btn.dataset.size, btn.dataset.qty);
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
    } else {
      showToast(data.message, "error");
    }

  } catch (err) {
    showToast("Something went wrong", "error");
  }
}


/* ---------------- UPDATE HEADER CART COUNT ---------------- */

async function updateCartCount() {
  const res = await fetch("/cart-count");
  const data = await res.json();

  const countEl = document.getElementById("cart-count");
  if (countEl) countEl.textContent = data.count;
}
