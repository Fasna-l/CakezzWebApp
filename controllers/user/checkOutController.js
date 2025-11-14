const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const crypto = require("crypto");

/* ------------------------------------
   GET CHECKOUT PAGE
-------------------------------------- */
const getCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = userId ? await User.findById(userId).lean() : null;

    const addressDoc = await Address.findOne({ user: userId });
    const addresses = addressDoc ? addressDoc.addresses : [];

    res.render("checkout", {
      user,
      addresses,
      checkoutItems: req.session.checkoutItems || [],
      totals: req.session.checkoutTotals || {}
    });

  } catch (err) {
    console.log(err);
    res.redirect("/pageerror");
  }
};

/* ------------------------------------
   ADD ADDRESS (CHECKOUT)
-------------------------------------- */
const postAddAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const data = req.body;

    let addressDoc = await Address.findOne({ user: userId });

    if (!addressDoc) {
      addressDoc = new Address({ user: userId, addresses: [] });
    }

    const hasDefault = addressDoc.addresses.some(a => a.isDefault);

    addressDoc.addresses.push({
      ...data,
      isDefault: hasDefault ? false : true
    });

    await addressDoc.save();
    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.json({ success: false });
  }
};

/* ------------------------------------
   EDIT ADDRESS
-------------------------------------- */
const getEditAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = userId ? await User.findById(userId).lean() : null;
    const addressId = req.params.id;

    const addressDoc = await Address.findOne({ user: userId });
    const address = addressDoc.addresses.id(addressId);

    res.render("checkout-edit-address", {
      user,
      address,
      checkoutItems: req.session.checkoutItems || [],
      totals: req.session.checkoutTotals || {}
    });

  } catch (err) {
    console.log(err);
    res.redirect("/pageerror");
  }
};

const postEditAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const addressId = req.params.id;
    const data = req.body;

    const addressDoc = await Address.findOne({ user: userId });
    Object.assign(addressDoc.addresses.id(addressId), data);

    await addressDoc.save();
    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.json({ success: false });
  }
};

/* ------------------------------------
   SAVE DELIVERY DATE (with validation)
-------------------------------------- */
/* ------------------------------------
   SAVE DELIVERY DATE (with validation + user-friendly redirect)
-------------------------------------- */
const saveDeliveryDate = async (req, res) => {
  try {
    

    const selectedDate = req.body.deliveryDate;
    console.log("saveDeliveryDate -> req.body.deliveryDate:", selectedDate);

    // debug (temporary) - uncomment while testing
    // console.log("SAVE DELIVERY: body =", req.body);

    // If empty
    if (!selectedDate || selectedDate.trim() === "") {
      // store friendly error in session and redirect back to personalize page
      req.session.deliveryError = "Please select a delivery date & time.";
      return res.redirect("/personalize?from=save");
    }

    const selected = new Date(selectedDate);
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    // If earlier than 1 hour from now
    if (selected < oneHourLater) {
      req.session.deliveryError = "Delivery must be at least 1 hour from now.";
      return res.redirect("/personalize?from=save");
    }

    // VALID → Save in session and clear any previous error
    req.session.deliveryDate = selectedDate;
    delete req.session.deliveryError;
    return res.redirect("/checkout/payment");

  } catch (err) {
    console.log("saveDeliveryDate error:", err);
    // set generic error
    req.session.deliveryError = "Something went wrong. Please try again.";
    return res.redirect("/personalize?from=save");
  }
};



/* ------------------------------------
   GET PAYMENT PAGE
-------------------------------------- */
const getPaymentPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = userId ? await User.findById(userId).lean() : null;

    res.render("payment", {
      user,
      checkoutItems: req.session.checkoutItems || [],
      totals: req.session.checkoutTotals || {},
      coupons: []
});

  } catch (err) {
    console.log(err);
    res.redirect("/pageerror");
  }
};

/* ------------------------------------
   PLACE ORDER
-------------------------------------- */
const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const paymentMethod = req.body.selectedPayment;

    const user = await User.findById(userId);

    const addressDoc = await Address.findOne({ user: userId });
    const selectedAddress = addressDoc.addresses.find(a => a.isDefault);

    const items = [];

    // 🔥 1️⃣ REDUCE STOCK FOR EACH ITEM
    for (let cart of req.session.checkoutItems) {
      const product = await Product.findById(cart.productId);

      const variant = product.variants.find(v => v.size === cart.size);
      if (!variant) continue;

      // Reduce stock
      variant.stock = Math.max(0, variant.stock - cart.quantity);

      await product.save();

      // Push order item
      items.push({
        productId: product._id,
        productName: product.productName,
        productImage: product.productImage[0],
        size: cart.size,
        price: variant.price,
        quantity: cart.quantity
      });
    }

    // 🔥 2️⃣ CREATE ORDER
    const order = new Order({
      orderId: "ORD-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
      userId,
      items,
      shippingAddress: {
        name: user.name,
        addressType: selectedAddress.addressType,
        streetAddress: selectedAddress.streetAddress,
        city: selectedAddress.city,
        district: selectedAddress.district,
        state: selectedAddress.state,
        landmark: selectedAddress.landmark,
        pinCode: selectedAddress.pincode,
        phoneNumber: selectedAddress.phone
      },
      subTotal: req.session.checkoutTotals.subTotal,
      offerDiscount: req.session.checkoutTotals.offerDiscount || 0,
      taxAmount: req.session.checkoutTotals.tax,
      shippingCharge: req.session.checkoutTotals.shipping,
      couponDiscount: 0,
      totalAmount: req.session.checkoutTotals.grandTotal,

      paymentMethod,
      paymentStatus: paymentMethod === "COD" ? "Pending" : "Processing",

      deliveryDate: req.session.deliveryDate
    });

    await order.save();

    // 🔥 3️⃣ CLEAR USER CART FROM DATABASE
    await Cart.findOneAndUpdate(
      { user: userId },
      { $set: { items: [] } }
    );

    // 🔥 4️⃣ CLEAR SESSION CART
    req.session.checkoutItems = [];
    req.session.checkoutTotals = null;

    // 🔥 5️⃣ REDIRECT
    return res.redirect(`/checkout/success/${order._id}`);

  } catch (err) {
    console.log(err);
    return res.redirect("/pageerror");
  }
};

/* ------------------------------------
   SUCCESS PAGE
-------------------------------------- */
const getSuccessPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = userId ? await User.findById(userId).lean() : null;

    const order = await Order.findById(req.params.orderId);

    res.render("payment-success", {
      user,
      orderId: order._id,
      deliveryDateFormatted: new Date(order.deliveryDate).toDateString()
    });

  } catch (err) {
    console.log(err);
    res.redirect("/pageerror");
  }
};

const getPersonalizePage = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = userId ? await User.findById(userId).lean() : null;

    const addressId = req.query.addressId || req.session.checkoutAddressId || null;

    // If address not selected, block access
    if (!addressId) {
      return res.redirect("/checkout");
    }

    // Pull any validation error saved by saveDeliveryDate
    const deliveryError = req.session.deliveryError || null;
    // clear it so it doesn't persist
    delete req.session.deliveryError;

    res.render("personalize", {
      user,
      addressId,
      checkoutItems: req.session.checkoutItems || [],
      totals: req.session.checkoutTotals || {},
      deliveryError
    });

  } catch (err) {
    console.log("Personalize Page Error:", err);
    res.redirect("/pageNotFound");
  }
};


module.exports = {
  getCheckout,
  postAddAddress,
  getEditAddress,
  postEditAddress,
  saveDeliveryDate,
  getPaymentPage,
  placeOrder,
  getSuccessPage,
  getPersonalizePage
};
