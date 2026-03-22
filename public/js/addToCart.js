let cartSelectedProductId = null;
let selectedQty = 1;

document.addEventListener("click", async function (e) {

  const popup = document.getElementById("cartWeightPopup");

  /* ---------------- PRODUCT DETAILS PAGE ---------------- */

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

  /* ---------------- HOME PAGE ADD TO CART ---------------- */

  if (e.target.closest(".cake-add-to-cart-btn")) {

    const btn = e.target.closest(".cake-add-to-cart-btn");

    cartSelectedProductId = btn.dataset.productId;
    selectedQty = btn.dataset.qty || 1;

    const variants = JSON.parse(btn.dataset.variants);

    const rect = btn.getBoundingClientRect();

    popup.style.top = window.scrollY + rect.bottom + "px";
    popup.style.left = window.scrollX + rect.left + "px";

    popup.innerHTML = variants.map(v => `
      <button 
        data-size="${v.size}"
        ${v.stock <= 0 ? "disabled class='out-stock'" : ""}>
        ${v.size} ${v.stock <= 0 ? "(Out)" : ""}
      </button>
    `).join("");

    popup.style.display = "block";

    return;
  }

  /* ---------------- SHOP PAGE ADD TO CART ---------------- */

  if (e.target.closest(".add-to-cart-btn") && !e.target.closest(".wishlist-icon")) {

    const btn = e.target.closest(".add-to-cart-btn");

    cartSelectedProductId = btn.dataset.productId;
    selectedQty = btn.dataset.qty || 1;

    const variants = JSON.parse(btn.dataset.variants);

    const rect = btn.getBoundingClientRect();

    popup.style.top = window.scrollY + rect.bottom + "px";
    popup.style.left = window.scrollX + rect.left + "px";

    popup.innerHTML = variants.map(v => `
      <button 
        data-size="${v.size}"
        ${v.stock <= 0 ? "disabled class='out-stock'" : ""}>
        ${v.size} ${v.stock <= 0 ? "(Out)" : ""}
      </button>
    `).join("");

    popup.style.display = "block";

    return;
  }

  /* ---------------- WEIGHT SELECT ---------------- */

  const weightBtn = e.target.closest("#cartWeightPopup button");

  if (weightBtn && cartSelectedProductId) {

    e.stopPropagation();

    const size = weightBtn.dataset.size;

    addItemToCart(cartSelectedProductId, size, selectedQty);

    popup.style.display = "none";
    cartSelectedProductId = null;

    return;
  }

  /* ---------------- CLICK OUTSIDE CLOSE ---------------- */

  if (
    popup &&
    popup.style.display === "block" &&
    !e.target.closest("#cartWeightPopup") &&
    !e.target.closest(".cake-add-to-cart-btn") &&
    !e.target.closest(".add-to-cart-btn")
  ) {
    popup.style.display = "none";
    cartSelectedProductId = null;
  }

});


/* ---------------- ADD ITEM TO CART ---------------- */

async function addItemToCart(productId, size, quantity) {

  try {

    const res = await fetch("/cart", {
    //const res = await fetch("/add-to-cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, size, quantity })
    });

    const data = await res.json();

    if (data.success) {

      showToast("Added to cart");

      updateCartCount();

      document
        .querySelectorAll(
          `.wishlist-icon[data-product-id="${productId}"][data-size="${size}"]`
        )
        .forEach(icon => icon.classList.remove("active"));

      if (typeof updateWishlistCount === "function") {
        updateWishlistCount();
      }

    } else {

      showToast(data.message, "error");

    }

  } catch (err) {

    console.error(err);
    showToast("Please Login to Continue", "error");

  }

}


/* ---------------- UPDATE CART COUNT ---------------- */

async function updateCartCount() {

  const res = await fetch("/cart-count");
  const data = await res.json();

  const countEl = document.getElementById("cart-count");

  if (countEl) {
    countEl.textContent = data.count;
  }

}
