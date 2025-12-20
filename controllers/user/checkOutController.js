const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const crypto = require("crypto");

/* ------------------------------------
   GET CHECKOUT PAGE
-------------------------------------- */
const getCheckout = async (req, res, next) => {
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

  } catch (error) {
    next(error);
    // console.log(err);
    // res.redirect("/pageerror");
  }
};

/* ------------------------------------
   ADD ADDRESS (CHECKOUT)
-------------------------------------- */
const postAddAddress = async (req, res, next) => {
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

  } catch (error) {
    next(error);
    // console.log(err);
    // res.json({ success: false });
  }
};

/* ------------------------------------
   EDIT ADDRESS
-------------------------------------- */
const getEditAddress = async (req, res, next) => {
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

  } catch (error) {
    next(error);
    // console.log(err);
    // res.redirect("/pageerror");
  }
};

const postEditAddress = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const addressId = req.params.id;
    const data = req.body;

    const addressDoc = await Address.findOne({ user: userId });
    Object.assign(addressDoc.addresses.id(addressId), data);

    await addressDoc.save();
    res.json({ success: true });

  } catch (error) {
    next(error);
    // console.log(err);
    // res.json({ success: false });
  }
};

/* ------------------------------------
   SAVE DELIVERY DATE (with validation)
-------------------------------------- */

const saveDeliveryDate = async (req, res, next) => {
  try {
    const selectedDate = req.body.deliveryDate;
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

  } catch (error) {
    next(error);
    // console.log("saveDeliveryDate error:", err);
    // // set generic error
    // req.session.deliveryError = "Something went wrong. Please try again.";
    // return res.redirect("/personalize?from=save");
  }
};



/* ------------------------------------
   GET PAYMENT PAGE
-------------------------------------- */
const getPaymentPage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const user = userId ? await User.findById(userId).lean() : null;

    res.render("payment", {
      user,
      checkoutItems: req.session.checkoutItems || [],
      totals: req.session.checkoutTotals || {},
      coupons: []
});

  } catch (error) {
    next(error);
    // console.log(err);
    // res.redirect("/pageerror");
  }
};

/* ------------------------------------
   PLACE ORDER
-------------------------------------- */
const placeOrder = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const paymentMethod = req.body.selectedPayment;

    const user = await User.findById(userId);
    if (!user) return res.redirect("/login");
    const addressDoc = await Address.findOne({ user: userId });
    const selectedAddress = addressDoc.addresses.find(a => a.isDefault);
    if (!selectedAddress) return res.redirect("/address");

    const items = [];
    // SAFETY VALIDATION BEFORE STOCK REDUCTION
    for (let cartItem of req.session.checkoutItems) {

      const product = await Product.findById(cartItem.productId).populate("category");
      const variant = product.variants.find(v => v.size === cartItem.size);

      // ❌ BLOCKED PRODUCT
      if (product.isBlocked) {
        req.session.checkoutError = `${product.productName} is unavailable.`;
        return res.redirect("/cart");
      }

      // ❌ DISABLED CATEGORY
      if (product.category?.isListed === false) {
        req.session.checkoutError = `${product.productName} belongs to a disabled category.`;
        return res.redirect("/cart");
      }

      // ❌ STOCK CHECK
      if (!variant || variant.stock < cartItem.quantity) {
        req.session.checkoutError = `${product.productName} is out of stock.`;
        return res.redirect("/cart");
      }
    }

    // NOW SAFE: Apply stock reduction & build order items
    for (let cartItem of req.session.checkoutItems) {

      const product = await Product.findById(cartItem.productId);
      const variant = product.variants.find(v => v.size === cartItem.size);

      variant.stock -= cartItem.quantity;
      await product.save();

      items.push({
        productId: product._id,
        productName: product.productName,
        productImage: product.productImage[0],
        size: cartItem.size,
        price: variant.price,
        quantity: cartItem.quantity,
        status: "Pending"
      });
    }


      /* ======================================================
       3. SET ORDER & PAYMENT STATUS (IMPORTANT FIX)
    ====================================================== */
    let orderStatus;
    let paymentStatus;

    if (paymentMethod === "RAZORPAY") {
      orderStatus = "Payment Pending";
      paymentStatus = "Pending";
    }

    if (paymentMethod === "COD") {
      orderStatus = "Processing";
      paymentStatus = "Pending";
    }

    //  CREATE ORDER
    const order = new Order({
     // orderId: "ORD-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
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
      orderStatus,
      paymentStatus,
      //paymentStatus: paymentMethod === "COD" ? "Pending" : "Processing",

      deliveryDate: req.session.deliveryDate
    });

    await order.save();

    //  CLEAR USER CART FROM DATABASE
    await Cart.findOneAndUpdate(
      { user: userId },
      { $set: { items: [] } }
    );

    //  CLEAR SESSION CART
    // req.session.checkoutItems = [];
    // req.session.checkoutTotals = null;
    if (paymentMethod === "COD") {
      req.session.checkoutItems = [];
      req.session.checkoutTotals = null;
    }

    //  REDIRECT
    if(paymentMethod === "COD"){
      return res.redirect(`/checkout/success/${order._id}`);
    }
    //return res.redirect(`/checkout/success/${order._id}`);
    if(paymentMethod === "RAZORPAY"){
      return res.json({
        online: true,
        orderId: order._id
      });
    }
    return res.redirect("/checkout");

  } catch (error) {
    next(error);
    // console.log(err);
    // return res.redirect("/pageerror");
  }
};

/* ------------------------------------
   SUCCESS PAGE
-------------------------------------- */
const getSuccessPage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const user = userId ? await User.findById(userId).lean() : null;

    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.redirect("/order");
    }

    const deliveryDateFormatted = order.deliveryDate
      ? new Date(order.deliveryDate).toDateString()
      : "Not Assigned";

    res.render("payment-success", {
      user,
      order,                     // IMPORTANT: send full order
      deliveryDateFormatted      // OK to keep this
    });

  } catch (error) {
    next(error);
    // console.log("getSuccessPage error:", err);
    // res.redirect("/pageNotFound");
  }
};



const getPersonalizePage = async (req, res, next) => {
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

  } catch (error) {
    next(error);
    // console.log("Personalize Page Error:", err);
    // res.redirect("/pageNotFound");
  }
};

// const loadPaymentFailurePage = async (req, res, next) => {
//   try {
//     const userId = req.session.user;
//     const user = await User.findById(userId).lean();

//     res.render("payment-failure", {
//       user
//     });
//   } catch (error) {
//     next(error);
//   }
// };

const loadPaymentFailurePage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId).lean();

    const orderId = req.params.orderId;

    // Optional: verify order belongs to user
    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.redirect("/order");
    }

    res.render("payment-failure", { user , orderId });

  } catch (error) {
    next(error);
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
  getPersonalizePage,
  loadPaymentFailurePage 
};
