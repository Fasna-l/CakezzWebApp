const Coupon = require("../../models/couponSchema");
const Cart = require("../../models/cartSchema");

/* =================================
   GET AVAILABLE COUPONS (payment.ejs)
================================= */
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

/* =================================
   APPLY COUPON
================================= */
const applyCoupon = async (req, res, next) => {
  try {
    const { couponCode } = req.body;
    const userId = req.session.user;

    if (!couponCode) {
      return res.json({
        success: false,
        message: "Coupon code is required",
      });
    }

    // ❌ Already applied
    if (req.session.appliedCoupon) {
      return res.json({
        success: false,
        message: "Coupon already applied",
      });
    }

    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
    });

    if (!coupon) {
      return res.json({
        success: false,
        message: "Invalid coupon",
      });
    }


    //  Ensure user-specific (referral) coupon is used only by assigned user
if (
  coupon.assignedUser &&
  coupon.assignedUser.toString() !== userId.toString()
) {
  return res.json({
    success: false,
    message: "This coupon is not assigned to you",
  });
}
        //step4:
    // GLOBAL USAGE LIMIT
if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
  return res.json({
    success: false,
    message: "Coupon usage limit reached",
  });
}

// PER-USER USAGE LIMIT
const userUsage = coupon.usersUsed.find(
  u => u.user.toString() === userId.toString()
);

if (userUsage && userUsage.count >= coupon.perUserLimit) {
  return res.json({
    success: false,
    message: "You have already used this coupon",
  });
}

if (coupon.usedCount >= coupon.usageLimit) {
  return res.json({
    success: false,
    message: "Coupon fully redeemed"
  });
}



    const now = new Date();
    if (coupon.startDate > now || coupon.expiryDate < now) {
      return res.json({
        success: false,
        message: "Coupon not valid",
      });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      return res.json({
        success: false,
        message: "Cart is empty",
      });
    }

    if (cart.totalAmount < coupon.minPurchaseAmount) {
      return res.json({
        success: false,
        message: `Minimum purchase amount is ₹${coupon.minPurchaseAmount}`,
      });
    }

    let discount = Math.floor(
      (cart.totalAmount * coupon.discountValue) / 100
    );

    if (
      coupon.maxDiscountAmount !== null &&
      discount > coupon.maxDiscountAmount
    ) {
      discount = coupon.maxDiscountAmount;
    }

    discount = Math.min(discount, cart.totalAmount);

    // UPDATE CHECKOUT TOTALS
    const totals = req.session.checkoutTotals;

    totals.discount = discount;
    totals.grandTotal = totals.subTotal + totals.shipping + totals.tax - discount;

    req.session.checkoutTotals = totals;


    // ✅ Store in session
    req.session.appliedCoupon = {
      couponId: coupon._id,
      code: coupon.code,
      discount,
    };

    // 🔴 UPDATE COUPON USAGE COUNTS
coupon.usedCount += 1;

if (userUsage) {
  userUsage.count += 1;
} else {
  coupon.usersUsed.push({
    user: userId,
    count: 1,
  });
}

await coupon.save();


    res.json({
      success: true,
      discount,
      grandTotal: totals.grandTotal
      //grandTotal: cart.totalAmount - discount,
    });
  } catch (error) {
    next(error);
  }
};

/* =================================
   REMOVE COUPON
================================= */
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


module.exports = {
  getAvailableCoupons,
  applyCoupon,
  removeCoupon,
};
