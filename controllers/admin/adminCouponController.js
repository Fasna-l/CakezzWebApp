const Coupon = require("../../models/couponSchema");

const listCoupons = async (req, res, next) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const query = {
      code: { $regex: search, $options: "i" }
    };

    const totalCoupons = await Coupon.countDocuments(query);

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalCoupons / limit);

    res.render("couponList", {
      coupons,
      search,
      currentPage: page,
      totalPages,
      limit
    });
  } catch (error) {
    next(error);
  }
};

const loadAddCoupon = async (req, res) => {
  res.render("addCoupon");
};

const createCoupon = async (req, res, next) => {
  try {
    let {
      code,
      name,
      description,
      discountValue,
      discountType,
      minPurchaseAmount,
      maxDiscountAmount,
      expiryDate,
      usageLimit
    } = req.body;

    if (!code || !name || !description || !discountValue || !expiryDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const exists = await Coupon.findOne({ code: code.toUpperCase() });
    if (exists) {
      return res.status(400).json({ message: "Coupon code already exists" });
    }

    if(discountValue < 1){
      return res.status(400).json({message:"Invalid discount value"})
    }
    if(discountType === "percentage" && discountValue >100){
      return res.status(400).json({message:"Percentage cannot exceed 100%"})
    }

    if (usageLimit === "" || usageLimit === undefined) {
      usageLimit = null;
    } else {
      usageLimit = Number(usageLimit);
    }
    await Coupon.create({
      code: code.toUpperCase(),
      name,
      description,
      discountType,
      discountValue,
      minPurchaseAmount: minPurchaseAmount || 0,
      maxDiscountAmount: discountType === "percentage" ? maxDiscountAmount || null : null,
      expiryDate,
      usageLimit,
      perUserLimit:1
    });

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
};

const loadEditCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.redirect("/admin/coupons");

    res.render("editCoupon", { coupon });
  } catch (error) {
    next(error);
  }
};

const updateCoupon = async (req, res, next) => {
  try {
    let {
      name,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      description,
      expiryDate,
      usageLimit
    } = req.body;

    if (discountValue < 1) {
      return res.status(400).json({ message: "Invalid discount value" });
    }

    if (discountType === "percentage" && discountValue > 100) {
      return res.status(400).json({ message: "Percentage cannot exceed 100%" });
    }

    if (usageLimit === "" || usageLimit === undefined) {
      usageLimit = null;
    } else {
      usageLimit = Number(usageLimit);
    }

    await Coupon.findByIdAndUpdate(req.params.id, {
      name,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount: discountType === "percentage" ? maxDiscountAmount || null : null,
      description,
      expiryDate,
      usageLimit,
      perUserLimit:1
    });

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

const toggleCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ success: false });

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({ success: true, isActive: coupon.isActive });
  } catch (error) {
    next(error);
  }
};

const deleteCoupon = async (req, res, next) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listCoupons,
  loadAddCoupon,
  createCoupon,
  loadEditCoupon,
  updateCoupon,
  toggleCoupon,
  deleteCoupon
};
