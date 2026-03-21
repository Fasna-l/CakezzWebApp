import Address from "../../models/addressSchema.js";
import Product from "../../models/productSchema.js";
import Order from "../../models/orderSchema.js";
import User from "../../models/userSchema.js";
import Cart from "../../models/cartSchema.js";
import Wallet from "../../models/walletSchema.js";
import Coupon from "../../models/couponSchema.js";
import ReferralSettings from "../../models/referralSettingsSchema.js";
import calculateBestOffer from "../../helpers/offerCalculator.js";
import crypto from "crypto";
import logger from "../../utils/logger.js";
import HTTP_STATUS from "../../utils/httpStatus.js";
import RESPONSE_MESSAGES from "../../utils/responseMessages.js";

const validateCheckoutItems = async (req)=>{
  if(!req.session.checkoutItems || req.session.checkoutItems.length === 0) {
    return {error:"Your cart is empty."}
  }

  for(let item of req.session.checkoutItems){
    const product = await Product.findById(item.productId).populate("category");

    if(!product){
      return {error:"A product in your cart no longer exists"};
    }

    //if Product Blocked or category is disabled
    if(product.isBlocked || product.category?.isListed === false){
      return {error: `${product.productName} is no longer available. Please remove it from cart.`};
    }

    //varient check(size,stock)
    const variant = product.variants.find(v=>v.size === item.size);
    if(!variant || variant.stock < item.quantity){
      return {error:`${product.productName} is out of stock, please update your cart.`};
    }
  }
  return {success:true}
};

const getCheckout = async (req, res, next) => {
  try {
    //validation check(like cart page)
    const validation = await validateCheckoutItems(req);
    if(validation.error){
      req.session.checkoutError = validation.error;
      return res.redirect("/cart")
    }
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
  }
};

// ADD ADDRESS (CHECKOUT)
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
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: RESPONSE_MESSAGES.SUCCESS
    });

  } catch (error) {
    next(error);
  }
};

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
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: RESPONSE_MESSAGES.SUCCESS
    });
  } catch (error) {
    next(error);
  }
};

const saveDeliveryDate = async (req, res, next) => {
  try {
    const selectedDate = req.body.deliveryDate;
    // If empty
    if (!selectedDate || selectedDate.trim() === "") {
      req.session.deliveryError = "Please select a delivery date & time.";
      return res.redirect("/personalize?from=save");
    }

    const selected = new Date(selectedDate);
    const now = new Date();
    //MIN = now + 1 hour
    const minAllowed = new Date(now.getTime() + 60 * 60* 1000);
    //MAX = today + 3 days
    const maxAllowed = new Date();
    maxAllowed.setDate(maxAllowed.getDate()+3);
    maxAllowed.setHours(23, 59, 0, 0);
    // If earlier than 1 hour from now
    if (selected < minAllowed) {
      req.session.deliveryError = "Delivery must be at least 1 hour from now.";
      return res.redirect("/personalize?from=save");
    }

    if(selected >maxAllowed){
      req.session.deliveryError = "Delivery date cannot be more than 3 days from today.";
      return res.redirect("/personalize?from=save");
    }
    // VALID → Save in session and clear any previous error
    req.session.deliveryDate = selectedDate;
    delete req.session.deliveryError;
    
    return res.redirect("/checkout/payment");

  } catch (error) {
    next(error);
  }
};

const getPaymentPage = async (req, res, next) => {
  try {
    const validation = await validateCheckoutItems(req);
    if(validation.error){
      req.session.checkoutError = validation.error;
      return res.redirect("/cart")
    }

    const userId = req.session.user;
    const user = userId ? await User.findById(userId).lean() : null;

    const totals = req.session.checkoutTotals || {};
    const cartTotal = totals.subTotal || 0;
    const now = new Date();

    const coupons = await Coupon.find({
      isActive: true,
      expiryDate: { $gt: now },
      minPurchaseAmount: { $lte: cartTotal }
    }).lean();

    const appliedCoupon = req.session.appliedCoupon || null;

    logger.info(
      `User ${userId} proceeded to checkout. Grand Total: ${totals.grandTotal || 0}`
    );
    
    res.render("payment", {
      user,
      checkoutItems: req.session.checkoutItems || [],
      totals,
      coupons,
      appliedCoupon
    });

  } catch (error) {
    next(error);
  }
};

const placeOrder = async (req, res, next) => {
  try {
    if (
      !req.session.checkoutTotals ||
      !req.session.checkoutTotals.grandTotal ||
      !req.session.checkoutItems ||
      req.session.checkoutItems.length === 0
    ) {
      req.session.checkoutError = "Your checkout session expired. Please try again.";
      return res.redirect("/cart");
    }

    const userId = req.session.user;
    const paymentMethod = req.body.selectedPayment;

    let walletUsed = 0;
    let remainingAmount = req.session.checkoutTotals.grandTotal;
    
    //COD limit (1000) 
    if (paymentMethod === "COD" && remainingAmount > 1000) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.COD_LIMIT_EXCEEDED
      });
    }
    
    let wallet = null;

    if (paymentMethod === "WALLET") {
      wallet = await Wallet.findOne({ userId });

    if (!wallet || wallet.balance <= 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.WALLET_EMPTY
      });
    }  

      walletUsed = Math.min(wallet.balance, remainingAmount);
      remainingAmount = remainingAmount - walletUsed;
    }

    const user = await User.findById(userId);
    if (!user) return res.redirect("/login");

    const addressDoc = await Address.findOne({ user: userId });
    const selectedAddress = addressDoc.addresses.find(a => a.isDefault);
    if (!selectedAddress) return res.redirect("/address");

    const items = [];

    // SAFETY CHECK BEFORE ORDER CREATE (NO STOCK DEDUCTION HERE)
    for (let cartItem of req.session.checkoutItems) {
      const product = await Product.findById(cartItem.productId).populate("category");
      const variant = product.variants.find(v => v.size === cartItem.size);

      if (product.isBlocked || product.category?.isListed === false) {
        req.session.checkoutError = `${product.productName} is unavailable.`;
        return res.redirect("/cart");
      }

      if (!variant || variant.stock < cartItem.quantity) {
        req.session.checkoutError = `${product.productName} is out of stock.`;
        return res.redirect("/cart");
      }

      const offer = await calculateBestOffer(product, variant.price);

      items.push({
        productId: product._id,
        productName: product.productName,
        productImage: product.productImage[0],
        size: cartItem.size,
        price: offer.finalPrice,
        quantity: cartItem.quantity,
        status: "Pending"
      });
    }

    let orderStatus;
    let paymentStatus;

    if (paymentMethod === "COD") {
      orderStatus = "Pending";
      paymentStatus = "Pending";
    }

    if (paymentMethod === "RAZORPAY") {
      orderStatus = "Pending";
      paymentStatus = "Pending";
    }

    if (paymentMethod === "WALLET") {
      if (remainingAmount === 0) {
        orderStatus = "Pending";
        paymentStatus = "Paid";
      } else {
        orderStatus = "Pending";
        paymentStatus = "Pending";
      }
    }

    const couponSession = req.session.appliedCoupon;
    const couponDiscount = couponSession ? couponSession.discount : 0;
    const couponCode = couponSession ? couponSession.code : null;
    const couponMinPurchase = couponSession ? couponSession.minPurchaseAmount : 0;
    
    const order = new Order({
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
      couponDiscount,
      originalCouponDiscount: couponDiscount,
      couponCode,
      couponMinPurchase,
      totalAmount: req.session.checkoutTotals.grandTotal,
      walletUsed,
      payableAmount: remainingAmount,
      paymentMethod,
      orderStatus,
      paymentStatus,
      deliveryDate: req.session.deliveryDate
    });

    await order.save();

    // ================= REFERRAL REWARD FOR REFERRER =================

    const orderCount = await Order.countDocuments({ userId });

    if (orderCount === 1 && user.referredBy) {

      const referrerWallet = await Wallet.findOne({ userId: user.referredBy });

      if (referrerWallet) {

        const settings = await ReferralSettings.findOne();

        const rewardAmount = settings?.referrerReward || 50;

        await referrerWallet.addTransaction({
          type: "referral",
          amount: rewardAmount,
          description: `Referral reward for ${user.name}'s first order`
        });

        logger.info(
          `REFERRAL REWARD | Referrer: ${user.referredBy} | Referred User: ${userId} | Amount: ₹${rewardAmount}`
        );
      }
    }

    // STOCK DEDUCTION FOR COD & FULL WALLET
    if (
      paymentMethod === "COD" ||
      (paymentMethod === "WALLET" && remainingAmount === 0)
    ) {
      for (let item of order.items) {
        const product = await Product.findById(item.productId);
        const variant = product.variants.find(v => v.size === item.size);

        if (variant) {
          variant.stock -= item.quantity;
          await product.save();
        }
      }
    }

    logger.info(
      `ORDER PLACED | UserId: ${userId} | OrderId: ${order._id} | Amount: ${order.totalAmount} | Payment: ${paymentMethod}`
    );

    // Update coupon usage
    if (couponSession) {
      const coupon = await Coupon.findById(couponSession.couponId);
      if (coupon) {
        coupon.usedCount += 1;
        const userUsage = coupon.usersUsed.find(u => u.user.toString() === userId.toString());
        if (userUsage) userUsage.count += 1;
        else coupon.usersUsed.push({ user: userId, count: 1 });
        await coupon.save();
      }
      delete req.session.appliedCoupon;
    }

    // Wallet Debit Logic
    if (paymentMethod === "WALLET" && walletUsed > 0) {
      await wallet.addTransaction({
        type: "purchase",
        amount: walletUsed,
        orderId: order._id,
        description: remainingAmount === 0
          ? "Full wallet payment"
          : "Partial wallet payment"
      });
    }

    // CLEAR SESSION ONLY FOR COD or WALLET FULL
    if (paymentMethod === "COD" || (paymentMethod === "WALLET" && remainingAmount === 0)) {
    logger.info(
      `PAYMENT SUCCESS | UserId: ${userId} | OrderId: ${order._id} | Method: ${paymentMethod} | Amount: ${order.totalAmount}`
    );

  // CLEAR CART FROM DATABASE
    await Cart.updateOne(
      { user: userId },
      { $set: { items: [] } }
    );

      req.session.checkoutItems = [];
      req.session.checkoutTotals = null;
      return res.redirect(`/orders/${order._id}/success`);
    }

    // RAZORPAY or PARTIAL WALLET
    return res.status(HTTP_STATUS.OK).json({
      online: true,
      orderId: order._id
    });

  } catch (error) {
    next(error);
  }
};

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
      order,                     // send full order
      deliveryDateFormatted      
    });

  } catch (error) {
    next(error);
  }
};

const getPersonalizePage = async (req, res, next) => {
  try {
    const validation = await validateCheckoutItems(req);
    if(validation.error){
      req.session.checkoutError = validation.error;
      return res.redirect("/cart")
    }
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
  }
};

const loadPaymentFailurePage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId).lean();

    const orderId = req.params.orderId;
    //verify order belongs to user
    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.redirect("/order");
    }

    res.render("payment-failure", { user , orderId });

  } catch (error) {
    next(error);
  }
};


export default {
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
