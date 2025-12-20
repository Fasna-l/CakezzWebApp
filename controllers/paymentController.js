const razorpay = require("../config/razorpay");
const Order = require("../models/orderSchema");
const crypto = require("crypto");

const createRazorpayOrder = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const options = {
      amount: order.totalAmount * 100, // paise
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


module.exports = {
  createRazorpayOrder,
  verifyPayment,
  markPaymentFailed
};

