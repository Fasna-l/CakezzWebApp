const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");
const calculateBestOffer = require("../../helpers/offerCalculator");


/* Helper: find variant */
function findVariant(product, size) {
  return product.variants.find(v => v.size === size);
}

/* --------------------------------------------------------
   ADD TO CART 
-------------------------------------------------------- */
const addToCart = async (req, res, next) => {
  try {   

    if (!req.session.user) {
      return res.json({
        success: false,
        message: "Please login to continue."
      });
    }

    const userId = req.session.user;
    const { productId, size, quantity } = req.body;

    if (!productId || !size) {
      return res.json({ success: false, message: "Invalid request" });
    }

    const qty = Number(quantity) || 1;

    const product = await Product.findById(productId).populate("category");

    if (!product) {
      return res.json({ success: false, message: "Product not found" });
    }

    if (product.isBlocked || product.category?.isListed === false) {
      return res.json({ success: false, message: "Product unavailable" });
    }

    const variant = findVariant(product, size);
    if (!variant) {
      return res.json({ success: false, message: "Invalid size" });
    }

    if (variant.stock <= 0) {
      return res.json({ success: false, message: "Out of stock" });
    }

    // Fetch user cart
    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // Check if item already exists
    const existing = cart.items.find(
      (i) => i.product.toString() === productId && i.size === size
    );

    if (existing) { 
      // MAX 5 LIMIT
      if (existing.quantity + qty > 5) {
        return res.json({
          success: false,
          message: "Maximum 5 per item allowed."
        });
      }

      // STOCK CHECK
      if (existing.quantity + qty > variant.stock) {
        return res.json({
          success: false,
          message: "Not enough stock"
        });
      }

      existing.quantity += qty;
    }else {
      cart.items.push({
        product: productId,
        size,
        quantity: qty,
        priceAtAdd: variant.price,
        stockAtAdd: variant.stock,
      });
    }

    await cart.save();
    await Wishlist.updateOne(
      { user: userId },
      { $pull: { items: { product: productId } } }
    );

    return res.json({ success: true, message: "Added to cart" });
  } catch (error) {
    next(error);
    // console.error("addToCart error:", error);
    // return res.json({ success: false, message: "Server error" });
  }
};

/* --------------------------------------------------------
   UPDATE QUANTITY
-------------------------------------------------------- */
const updateQuantity = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const { productId, size, quantity } = req.body;

    //let cart = await Cart.findOne({ user: userId }).populate("items.product");
    let cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.product",
        populate: { path: "category" }
      });


    if (!cart) return res.json({ success: false, message: "Cart not found" });

    const item = cart.items.find(
      (i) => i.product._id.toString() === productId && i.size === size
    );
    if (!item) return res.json({ success: false, message: "Item not found" });

    const variant = findVariant(item.product, size);
    if (!variant) return res.json({ success: false, message: "Invalid size" });

    if (quantity > variant.stock) {
      return res.json({ success: false, message: "Not enough stock" });
    }

    item.quantity = quantity;
    await cart.save();

    // STEP 6: AUTO REMOVE COUPON IF CART CHANGES
if (req.session.appliedCoupon) {
  delete req.session.appliedCoupon;

  if (req.session.checkoutTotals) {
    delete req.session.checkoutTotals.discount;
    req.session.checkoutTotals.grandTotal =
      req.session.checkoutTotals.subTotal +
      req.session.checkoutTotals.shipping +
      req.session.checkoutTotals.tax;
  }
}

    const cartItems = await Promise.all(
  cart.items.map(async (item) => {
    const variant = item.product.variants.find(v => v.size === item.size);
    const offer = await calculateBestOffer(item.product, variant.price);

    return {
      productId: item.product._id.toString(),
      size: item.size,
      price: offer.finalPrice,
      quantity: item.quantity,
      subtotal: offer.finalPrice * item.quantity
    };
  })
);

const subtotal = cartItems.reduce((a, b) => a + b.subtotal, 0);
const tax = Math.round(subtotal * 0.05);
const shipping = 50;
const total = subtotal + tax + shipping;

res.json({
  success: true,
  cartItems,
  summary: { subtotal, tax, shipping, total }
});


    // res.json({ success: true, cart });
  } catch (error) {
    next(error);
    // console.error("updateQuantity error:", error);
    // res.json({ success: false, message: "Server error" });
  }
};

const removeCartItem = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const { productId, size } = req.body;

    const result = await Cart.updateOne(
      { user: userId },
      { $pull: { items: { product: productId, size: size } } }
    );

    if (result.modifiedCount === 0) {
      return res.json({ success: false, message: "Item not found" });
    }

    // STEP 6: AUTO REMOVE COUPON IF CART CHANGES
if (req.session.appliedCoupon) {
  delete req.session.appliedCoupon;

  if (req.session.checkoutTotals) {
    delete req.session.checkoutTotals.discount;
    req.session.checkoutTotals.grandTotal =
      req.session.checkoutTotals.subTotal +
      req.session.checkoutTotals.shipping +
      req.session.checkoutTotals.tax;
  }
}

// const cart = await Cart.findOne({ user: userId }).populate("items.product");
const cart = await Cart.findOne({ user: userId })
  .populate({
    path: "items.product",
    populate: { path: "category" }
  });


const cartItems = await Promise.all(
  cart.items.map(async (item) => {
    const variant = item.product.variants.find(v => v.size === item.size);
    const offer = await calculateBestOffer(item.product, variant.price);

    return {
      productId: item.product._id.toString(),
      size: item.size,
      price: offer.finalPrice,
      quantity: item.quantity,
      subtotal: offer.finalPrice * item.quantity
    };
  })
);

const subtotal = cartItems.reduce((a, b) => a + b.subtotal, 0);
const tax = Math.round(subtotal * 0.05);
const shipping = 50;
const total = subtotal + tax + shipping;

return res.json({
  success: true,
  cartItems,
  summary: { subtotal, tax, shipping, total }
});


    // return res.json({ success: true, message: "Item removed" });
  } catch (error) {
    next(error);
    // console.error("removeCartItem error:", error);
    // return res.json({ success: false, message: "Server error" });
  }
};

/* --------------------------------------------------------
   PROCEED TO CHECKOUT
-------------------------------------------------------- */
const proceedToCheckout = async (req, res, next) => {
  try {
    const userId = req.session.user;

    //const cart = await Cart.findOne({ user: userId }).populate("items.product");
    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.product",
        populate: { path: "category" }
      });

    console.log("cart:"+cart)

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

     // VALIDATION LOOP
    for (let item of cart.items) {
      const product = item.product;
      const variant = product.variants.find(v => v.size === item.size);

      //  BLOCKED PRODUCT
      if (product.isBlocked || product.category?.isListed === false) {
        req.session.checkoutError =
          `${product.productName} is no longer available. Remove it to continue.`;
        return res.redirect("/cart");
      }

      //  OUT OF STOCK
      if (!variant || variant.stock < item.quantity) {
        req.session.checkoutError =
          `${product.productName} is out of stock. Update or remove it to proceed.`;
        return res.redirect("/cart");
      }
    }

    const checkoutItems = [];

for (let item of cart.items) {
  const product = item.product;
  const variant = product.variants.find(v => v.size === item.size);

  const offer = await calculateBestOffer(product, variant.price);

  checkoutItems.push({
    productId: product._id,
    product: {
      name: product.productName,
      image: product.productImage[0]
    },
    size: item.size,
    quantity: item.quantity,
    price: offer.finalPrice
  });
}

    

    // Calculate totals
    let subTotal = 0;
    checkoutItems.forEach((ci) => {
      subTotal += ci.price * ci.quantity;
    });

    //const shipping = subTotal > 500 ? 0 : 50;
    const shipping = 50;
    const tax = Math.round(subTotal * 0.05);
    const grandTotal = subTotal + shipping + tax;

    // SAVE TO SESSION
    req.session.checkoutItems = checkoutItems;
    req.session.checkoutTotals = {
      subTotal,
      shipping,
      tax,
      grandTotal
    };

    res.redirect("/checkout");

  } catch (error) {
    next(error);
    // console.error("proceedToCheckout error:", error);
    // res.redirect("/pageNotFound");
  }
};


const getCartPage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const user = userId ? await User.findById(userId).lean() : null;

    //const cart = await Cart.findOne({ user: userId }).populate("items.product");
    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.product",
        populate: { path: "category" }
      });

    const cartCount = cart ? cart.items.length : 0;

    if (!cart) {
      return res.render("cart", {
        user,
        cartItems: [],
        subtotal: 0,
        cartCount
      });
    }

    const cartItems = await Promise.all(
      cart.items.map(async (item) => {

        const isUnavailable =
          item.product.isBlocked ||
          (item.product.category?.isListed === false);

        const variant = item.product.variants.find(v => v.size === item.size);
        const isOutOfStock = variant?.stock <= 0;

        const offer = await calculateBestOffer(item.product, variant.price);
        const finalPrice = offer.finalPrice;

        return {
          productId: item.product._id,
          name: item.product.productName,
          size: item.size,
          image: item.product.productImage[0],
          price: finalPrice,
          quantity: item.quantity,
          subtotal: finalPrice * item.quantity,
          isUnavailable,
          isOutOfStock
        };
      })
    );


    const subtotal = cartItems.reduce((a, b) => a + b.subtotal, 0);

    const tax = Math.round(subtotal * 0.05);
    //Always add ₹50 shipping
    const shipping = 50;
    //  Final total for cart page
    const total = subtotal + shipping + tax;

    res.render("cart", {
      user,
      cartItems,
      subtotal,
      tax,
      shipping,
      total,
      cartCount,
      checkoutError: req.session.checkoutError || null
    });
    req.session.checkoutError = null;
  } catch (error) {
    next(error);
    // console.error("getCartPage error:", error);
    // res.redirect("/pageNotFound");
  }
};


module.exports = {
  addToCart,
  updateQuantity,
  removeCartItem,
  proceedToCheckout,
  getCartPage
};
