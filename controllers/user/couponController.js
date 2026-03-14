import Coupon from "../../models/couponSchema.js";
import Cart from "../../models/cartSchema.js";

// GET AVAILABLE COUPONS (payment.ejs)
const getAvailableCoupons = async (req, res, next) => {
  try {
    const now = new Date();
    const userId = req.session.user;
    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: now },
      expiryDate: { $gte: now },
      $or: [
    { assignedUser: null },      // global coupons
    { assignedUser: userId }     // referral coupons
  ]
    }).select("code description discountValue minPurchaseAmount maxDiscountAmount");
    res.json({ success: true, coupons });
  } catch (error) {
    next(error);
  }
};

const applyCoupon = async (req, res, next) => {
  try {
    const { couponCode } = req.body;
    const userId = req.session.user;

    if (!couponCode) {
      return res.json({ success: false, message: "Coupon code is required" });
    }
    // Prevent double apply
    if (req.session.appliedCoupon) {
      return res.json({ success: false, message: "Coupon already applied" });
    }

    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
    });

    if (!coupon) {
      return res.json({ success: false, message: "Invalid coupon" });
    }
    // Validate assigned-user referral coupon
    if (coupon.assignedUser && coupon.assignedUser.toString() !== userId.toString()) {
      return res.json({ success: false, message: "This coupon is not assigned to you" });
    }

    const now = new Date();
    if (coupon.startDate > now || coupon.expiryDate < now) {
      return res.json({ success: false, message: "Coupon not valid right now" });
    }
    // ==== USAGE LIMIT CHECKS ====
    const userUsage = coupon.usersUsed.find(u => u.user.toString() === userId.toString());
    // Global usage limit (null = infinite)
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return res.json({ success: false, message: "Coupon usage limit reached" });
    }
    // Per-user usage limit (null = infinite)
    if (coupon.perUserLimit !== null && userUsage && userUsage.count >= coupon.perUserLimit) {
      return res.json({ success: false, message: "You have already used this coupon" });
    }
    // ===== CART VALIDATION BASED ON OFFER PRICE =====
    const checkoutItems = req.session.checkoutItems || [];
    const totals = req.session.checkoutTotals || {};

    if (!checkoutItems.length) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    // Calculate subtotal from final (offer) price
    let subTotal = 0;
    checkoutItems.forEach(item => {
      subTotal += item.price * item.quantity;  // item.price is finalPrice from offer
    });

    // Validate coupon minimum purchase amount
    if (subTotal < coupon.minPurchaseAmount) {
      return res.json({
        success: false,
        message: `Minimum purchase amount is ₹${coupon.minPurchaseAmount}`
      });
    }
    // === Discount Calculation ===
    //let discount = Math.floor((subTotal * coupon.discountValue) / 100);
    let discount = 0;
    if(coupon.discountType === "percentage"){
      discount = Math.floor((subTotal * coupon.discountValue) / 100);

      // Apply max discount cap (if exists)
      if (coupon.maxDiscountAmount !== null) {
        discount = Math.min(discount, coupon.maxDiscountAmount);
      }
    }else if(coupon.discountType === "flat"){
      discount = coupon.discountValue
    }  
    // Prevent negative or beyond subtotal
    discount = Math.min(discount, subTotal);

    // Update checkout totals
    totals.discount = discount;
    totals.grandTotal = totals.subTotal + totals.shipping + totals.tax - discount;
    req.session.checkoutTotals = totals;

    // Store coupon details in session for placeOrder()
    req.session.appliedCoupon = {
      couponId: coupon._id,
      code: coupon.code,
      discount,
      minPurchaseAmount: coupon.minPurchaseAmount
    };

    return res.json({
      success: true,
      discount,
      grandTotal: totals.grandTotal,
      maxDiscount: coupon.maxDiscountAmount,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue
    });

  } catch (error) {
    next(error);
  }
};

const removeCoupon = async (req, res, next) => {
  try {
    if (!req.session.appliedCoupon) {
      return res.json({ success: false });
    }
    const totals = req.session.checkoutTotals;
    delete totals.discount;
    totals.grandTotal =
      totals.subTotal + totals.shipping + totals.tax;
    req.session.checkoutTotals = totals;
    delete req.session.appliedCoupon;
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};


export default {
  getAvailableCoupons,
  applyCoupon,
  removeCoupon,
};
