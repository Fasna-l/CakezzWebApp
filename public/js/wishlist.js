document.addEventListener("click", async (e) => {

  const addToCartBtn = e.target.closest(".add-to-cart-btn.from-wishlist");

  if (addToCartBtn && window.location.pathname.includes("/wishlist")) {
    e.preventDefault();
    e.stopImmediatePropagation();

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

/*  FAILED CASES:
   - Out of stock
   - Max quantity exceeded
*/
    if (!data.success) {
      showToast(data.message, "error");
      return; 
    }

/* ✅ SUCCESS CASE ONLY */

// Remove from UI
const card = addToCartBtn.closest(".product-card");
if (card) card.remove();

// Update count
const countEl = document.getElementById("wishlist-page-count");
if (countEl) {
  countEl.textContent = Math.max(0, Number(countEl.textContent) - 1);
}
updateWishlistCount();

// Remove from backend wishlist
fetch("/wishlist/remove", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ productId })
});

showToast("Added to cart");



    } catch (err) {
      console.error("Cart add failed:", err);
    }

    return;
  }

  /* ===============================
     REMOVE FROM WISHLIST PAGE
  ================================ */
  const removeBtn = e.target.closest(".remove-from-wishlist");

  if (removeBtn && window.location.pathname.includes("/wishlist")) {
    e.preventDefault();

    const productId = removeBtn.dataset.productId;

    fetch("/wishlist/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId })
    })
      .then(() => {
        removeBtn.closest(".product-card")?.remove();

        const countEl = document.getElementById("wishlist-page-count");
        if (countEl) {
          countEl.textContent = Math.max(
            0,
            Number(countEl.textContent) - 1
          );
        }

        updateWishlistCount();

        document
          .querySelectorAll(`.wishlist-icon[data-product-id="${productId}"]`)
          .forEach(icon => icon.classList.remove("active"));

        showToast("Removed from wishlist");
      })
      .catch(() => {
        showToast("Something went wrong", "error");
      });

    return;
  }

  /* ===============================
     HEART TOGGLE (OTHER PAGES)
  ================================ */
  const heart = e.target.closest(".wishlist-icon");

  if (heart && !window.location.pathname.includes("/wishlist")) {
    e.preventDefault();

    const productId = heart.dataset.productId;

    fetch("/wishlist/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          showToast(data.message, "error");
          return;
        }

        heart.classList.toggle("active", data.isAdded);
        updateWishlistCount();
        showToast(data.message);
      })
      .catch(() => {
        showToast("Please login to continue", "error");
      });
  }
});

/* ===============================
   UPDATE HEADER COUNT
================================ */
async function updateWishlistCount() {
  try {
    const res = await fetch("/wishlist-count");
    const data = await res.json();
    const el = document.getElementById("wishlist-count");
    if (el) el.textContent = data.count;
  } catch {}
}

document.addEventListener("DOMContentLoaded", updateWishlistCount);
