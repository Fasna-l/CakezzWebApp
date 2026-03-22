let wishlistSelectedProductId = null;
let wishlistVariants = [];
const popup = document.getElementById("weightPopup");

document.addEventListener("click", async (e) => {

  /*REMOVE FROM WISHLIST PAGE */

  const removeBtn = e.target.closest(".remove-from-wishlist");

  if (removeBtn && window.location.pathname.includes("/wishlist")) {

    const productId = removeBtn.dataset.productId;
    const size = removeBtn.dataset.size;

    try {

      await fetch("/wishlist", {
        method: "DELETE",
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

    } catch (err) {
      console.error(err);
    }

    return;
  }


  /*ADD TO CART FROM WISHLIST PAGE*/

  const addToCartBtn = e.target.closest(".add-to-cart-btn.from-wishlist");

  if (addToCartBtn && window.location.pathname.includes("/wishlist")) {

    const productId = addToCartBtn.dataset.productId;
    const size = addToCartBtn.dataset.size;
    const qty = addToCartBtn.dataset.qty || 1;

    try {

      const res = await fetch("/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, size, quantity: qty })
      });

      const data = await res.json();

      if (!data.success) {
        showToast(data.message, "error");
        return;
      }

      addToCartBtn.closest(".product-card")?.remove();

      const countEl = document.getElementById("wishlist-page-count");
      if (countEl) {
        countEl.textContent = Math.max(0, Number(countEl.textContent) - 1);
      }

      await fetch("/wishlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, size })
      });

      updateWishlistCount();
      updateCartCount();
      showToast("Added to cart");

    } catch (err) {
      console.error(err);
    }

    return;
  }

  /*PRODUCT DETAILS PAGE WISHLIST */

const pdHeart = e.target.closest("#pd-wishlist");

if (pdHeart) {

  e.preventDefault();

  const productId = pdHeart.dataset.productId;

  const activeWeight = document.querySelector(".weight-btn.active");

  if (!activeWeight) {
    showToast("Please select a weight", "error");
    return;
  }

  const size = activeWeight.dataset.size;

  try {
    const res = await fetch("/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, size })
    });

    const data = await res.json();

    if (!data.success) {
      showToast(data.message || "Please login", "error");
      return;
    }

    pdHeart.classList.toggle("active", data.isAdded);

    /* update local wishlistItems array */
    if (typeof wishlistItems !== "undefined") {

      if (data.isAdded) {
        wishlistItems.push({ product: productId, size });
      } else {
        const index = wishlistItems.findIndex(
          item =>
            String(item.product) === String(productId) &&
            item.size === size
        );

        if (index > -1) wishlistItems.splice(index, 1);
      }

    }

    updateWishlistCount();

    showToast(data.message);

  } catch (err) {
    console.error(err);
    showToast("Something went wrong", "error");
  }

  return;
}

  /*HEART CLICK (HOME / SHOP) */

  const heart = e.target.closest(".wishlist-icon");

  if (
    heart &&
    !window.location.pathname.includes("/wishlist") &&
    heart.id !== "pd-wishlist"
  ) {

    e.preventDefault();

    wishlistSelectedProductId = heart.dataset.productId;

    if (!popup) return;

    const card = heart.closest(".cake-card, .product-card");
    const btn = card?.querySelector(".cake-add-to-cart-btn, .add-to-cart-btn");

    if (!btn) return;

    wishlistVariants = JSON.parse(btn.dataset.variants || "[]");

    const rect = heart.getBoundingClientRect();

    popup.style.top = window.scrollY + rect.bottom + 6 + "px";
    popup.style.left = window.scrollX + rect.left + "px";

    popup.innerHTML = wishlistVariants.map(v => `
      <button data-size="${v.size}">
        ${v.size}
      </button>
    `).join("");

    popup.style.display = "block";

    return;
  }


  /* WEIGHT SELECT FROM POPUP */

  const weightBtn = e.target.closest("#weightPopup button");

  if (weightBtn && wishlistSelectedProductId) {

    const size = weightBtn.dataset.size;

    try {

      const res = await fetch("/wishlist",{
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: wishlistSelectedProductId,
          size
        })
      });

      const data = await res.json();

      if (!data.success) {
        showToast(data.message || "Please login", "error");
        return;
      }

      document
        .querySelectorAll(
          `.wishlist-icon[data-product-id="${wishlistSelectedProductId}"]`
        )
        .forEach(icon =>
          icon.classList.toggle("active", data.isAdded)
        );

      updateWishlistCount();
      showToast(data.message);

      popup.style.display = "none";
      wishlistSelectedProductId = null;

    } catch (err) {
      console.error(err);
    }

    return;
  }


  /*CLICK OUTSIDE CLOSE POPUP */

  if (
    popup &&
    popup.style.display === "block" &&
    !e.target.closest("#weightPopup") &&
    !e.target.closest(".wishlist-icon")
  ) {
    popup.style.display = "none";
    wishlistSelectedProductId = null;
  }

});


/*UPDATE HEADER COUNT */

async function updateWishlistCount() {

  try {

    const res = await fetch("/wishlist/count");
    const data = await res.json();

    const el = document.getElementById("wishlist-count");

    if (el) el.textContent = data.count;

  } catch {}

}

document.addEventListener("DOMContentLoaded", updateWishlistCount);
