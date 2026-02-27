const razorpay = require("../config/razorpay");
const Order = require("../models/orderSchema");
const Product = require("../models/productSchema");
const Cart = require("../models/cartSchema");
const Wallet = require("../models/walletSchema");
const crypto = require("crypto");

//create Razorpay order 
const createRazorpayOrder = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const options = {
      amount: order.payableAmount * 100,
      currency: "INR",
      receipt: order.orderId,
    };

    const razorpayOrder = await razorpay.orders.create(options);
    // store razorpay order id
    order.paymentDetails.razorpayOrderId = razorpayOrder.id;
    await order.save();
    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      razorpayOrder,
    });
  } catch (error) {
    next(error)
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    const order = await Order.findById(orderId);
    if (!order) return res.json({ success: false });

    if (expectedSign !== razorpay_signature) {
      order.paymentStatus = "Failed";
      order.orderStatus = "Payment Failed";
      await order.save();
      return res.json({ success: false });
    }

    //STOCK DEDUCTION AFTER SUCCESS
    for (let item of order.items) {
      const product = await Product.findById(item.productId);
      const variant = product.variants.find(v => v.size === item.size);

      if (variant) {
        variant.stock -= item.quantity;
        await product.save();
      }
    }

    // UPDATE ORDER STATUS
    order.paymentStatus = "Paid";
    order.orderStatus = "Pending";
    order.paymentDetails.razorpayPaymentId = razorpay_payment_id;
    order.paymentDetails.razorpaySignature = razorpay_signature;

    order.items.forEach(it => { it.status = "Pending" });
    await order.save();
    // CLEAR CART ONLY AFTER SUCCESS
    await Cart.findOneAndUpdate(
      { user: order.userId },
      { $set: { items: [] } }
    );

    req.session.checkoutItems = [];
    req.session.checkoutTotals = null;

    return res.json({ success: true });

  } catch (error) {
    next(error);
  }
};

const markPaymentFailed = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: "Failed",
      orderStatus: "Payment Failed"
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const retryPayment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order || order.paymentStatus === "Paid") {
      return res.redirect("/order");
    }
    // If there is still payable amount → Razorpay retry
    if (order.payableAmount > 0) {
      return retryRazorpay(order, res);
    }
    // If nothing pending (edge case)
    return res.redirect(`/checkout/success/${order._id}`);
  } catch (error) {
    next(error);
  }
};

const retryRazorpay = async (order, res) => {
  const razorpayOrder = await razorpay.orders.create({
    amount: order.payableAmount * 100, // ONLY pending amount
    currency: "INR",
    receipt: `retry_${order.orderId}`
  });

  order.paymentDetails.razorpayOrderId = razorpayOrder.id;
  await order.save();

  res.render("retry-payment", {
    order,
    razorpayOrder,
    key: process.env.RAZORPAY_KEY_ID
  });
};

module.exports = {
  createRazorpayOrder,
  verifyPayment,
  markPaymentFailed,
  retryPayment
};

