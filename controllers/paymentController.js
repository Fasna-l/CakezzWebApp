const razorpay = require("../config/razorpay");
const Order = require("../models/orderSchema");
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
      //amount: order.totalAmount * 100, // paise
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
    // console.error(error);
    // res.status(500).json({ success: false });
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

    if (expectedSign !== razorpay_signature) {
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: "Failed",
        orderStatus: "Payment Failed"
      });
      return res.json({ success: false });
    }

    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: "Paid",
      orderStatus: "Processing",
      "paymentDetails.razorpayPaymentId": razorpay_payment_id,
      "paymentDetails.razorpaySignature": razorpay_signature,
      $set: {
      "items.$[].status": "Processing" //  update all items
    }
    });

    req.session.checkoutItems = [];
    req.session.checkoutTotals = null;

    res.json({ success: true });
  } catch (error) {
    next(error)
    // console.error(error);
    // res.status(500).json({ success: false });
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
    amount: order.payableAmount * 100, // ✅ ONLY pending amount
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

