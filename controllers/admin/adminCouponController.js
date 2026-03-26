import Coupon from "../../models/couponSchema.js";
import logger from "../../utils/logger.js";
import HTTP_STATUS from "../../utils/httpStatus.js";
import RESPONSE_MESSAGES from "../../utils/responseMessages.js";

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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: RESPONSE_MESSAGES.MISSING_FIELDS
      });
    }

    const exists = await Coupon.findOne({ code: code.toUpperCase() });
    if (exists) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: RESPONSE_MESSAGES.COUPON_ALREADY_EXISTS
      });
    }

    if (discountValue < 1) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: RESPONSE_MESSAGES.INVALID_DISCOUNT_VALUE
      });
    }
    if (discountType === "percentage" && discountValue > 100) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: RESPONSE_MESSAGES.INVALID_PERCENTAGE
      });
    }

    if (usageLimit === "" || usageLimit === undefined) {
      usageLimit = null;
    } else {
      usageLimit = Number(usageLimit);
    }
    const newCoupon = await Coupon.create({
      code: code.toUpperCase(),
      name,
      description,
      discountType,
      discountValue,
      minPurchaseAmount: minPurchaseAmount || 0,
      maxDiscountAmount: discountType === "percentage" ? maxDiscountAmount || null : null,
      expiryDate,
      usageLimit,
      perUserLimit: 1
    });

    logger.info(
      `ADMIN COUPON CREATED | Code: ${newCoupon.code} | Type: ${newCoupon.discountType} | Value: ${newCoupon.discountValue}`
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: RESPONSE_MESSAGES.SUCCESS
    });
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: RESPONSE_MESSAGES.INVALID_DISCOUNT_VALUE
      });
    }

    if (discountType === "percentage" && discountValue > 100) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: RESPONSE_MESSAGES.INVALID_PERCENTAGE
      });
    }

    if (usageLimit === "" || usageLimit === undefined) {
      usageLimit = null;
    } else {
      usageLimit = Number(usageLimit);
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(req.params.id, {
      name,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount: discountType === "percentage" ? maxDiscountAmount || null : null,
      description,
      expiryDate,
      usageLimit,
      perUserLimit: 1
    }, { new: true });

    logger.info(
      `ADMIN COUPON UPDATED | Code: ${updatedCoupon.code} | Type: ${updatedCoupon.discountType} | Value: ${updatedCoupon.discountValue}`
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: RESPONSE_MESSAGES.SUCCESS
    });
  } catch (error) {
    next(error);
  }
};

const toggleCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon)
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: RESPONSE_MESSAGES.COUPON_NOT_FOUND
      });

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    logger.warn(
      `ADMIN COUPON TOGGLED | Code: ${coupon.code} | Active: ${coupon.isActive}`
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: RESPONSE_MESSAGES.SUCCESS,
      isActive: coupon.isActive
    });
  } catch (error) {
    next(error);
  }
};

const deleteCoupon = async (req, res, next) => {
  try {
    const deletedCoupon = await Coupon.findByIdAndDelete(req.params.id);
    if (deletedCoupon) {
      logger.warn(
        `ADMIN COUPON DELETED | Code: ${deletedCoupon.code}`
      );
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: RESPONSE_MESSAGES.SUCCESS
    });
  } catch (error) {
    next(error);
  }
};

export default {
  listCoupons,
  loadAddCoupon,
  createCoupon,
  loadEditCoupon,
  updateCoupon,
  toggleCoupon,
  deleteCoupon,
};
