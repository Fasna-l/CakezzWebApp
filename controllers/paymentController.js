import razorpay from "../config/razorpay.js";
import Order from "../models/orderSchema.js";
import Product from "../models/productSchema.js";
import Cart from "../models/cartSchema.js";
import crypto from "crypto";
import logger from "../utils/logger.js";
import HTTP_STATUS from "../utils/httpStatus.js";
import RESPONSE_MESSAGES from "../utils/responseMessages.js";

//create Razorpay order 
const createRazorpayOrder = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: RESPONSE_MESSAGES.ORDER_NOT_FOUND
      });
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

    logger.info(
      `RAZORPAY ORDER CREATED | UserId: ${order.userId} | OrderId: ${order._id} | Amount: ${order.payableAmount}`
    );

    res.status(HTTP_STATUS.OK).json({
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
    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: RESPONSE_MESSAGES.ORDER_NOT_FOUND
      });
    }

    if (expectedSign !== razorpay_signature) {
      logger.error(
        `PAYMENT SIGNATURE MISMATCH | UserId: ${order.userId} | OrderId: ${order._id}`
      );

      order.paymentStatus = "Failed";
      order.orderStatus = "Payment Failed";
      await order.save();

      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.INVALID_REQUEST
      });
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
    logger.info(
      `PAYMENT SUCCESS | UserId: ${order.userId} | OrderId: ${order._id} | RazorpayPaymentId: ${razorpay_payment_id} | Amount: ${order.totalAmount}`
    );
    // CLEAR CART ONLY AFTER SUCCESS
    await Cart.findOneAndUpdate(
      { user: order.userId },
      { $set: { items: [] } }
    );

    req.session.checkoutItems = [];
    req.session.checkoutTotals = null;

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: RESPONSE_MESSAGES.SUCCESS
    });

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

    logger.warn(
      `PAYMENT FAILED | OrderId: ${orderId}`
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: RESPONSE_MESSAGES.SUCCESS
    });

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
      logger.info(
        `PAYMENT RETRY INITIATED | UserId: ${order.userId} | OrderId: ${order._id}`
      );
      return retryRazorpay(order, res);
    }

    return res.redirect(`/orders/${order._id}/success`);
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

export default {
  createRazorpayOrder,
  verifyPayment,
  markPaymentFailed,
  retryPayment
};

