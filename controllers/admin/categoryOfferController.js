import CategoryOffer from "../../models/categoryOfferSchema.js";
import Category from "../../models/categorySchema.js";
import logger from "../../utils/logger.js";
import HTTP_STATUS from "../../utils/httpStatus.js";
import RESPONSE_MESSAGES from "../../utils/responseMessages.js";

const loadAddCategoryOffer = async (req, res, next) => {
  try {
    const { categoryId } = req.query;
    const categories = await Category.find({ isListed: true });
    res.render("addCategoryOffer", {
      categories,
      selectedCategoryId: categoryId || null
    });
  } catch (error) {
    next(error);
  }
};

const addCategoryOffer = async (req, res, next) => {
  try {
    const { categoryId, startDate, endDate, discount } = req.body;
    const existingOffer = await CategoryOffer.findOne({
      category: categoryId,
      isActive: true,
      endDate: { $gte: new Date() }
    });

    if (existingOffer) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.CATEGORY_OFFER_ALREADY_EXISTS
      });
    }

    const offer = await CategoryOffer.create({
      category: categoryId,
      startDate,
      endDate,
      discount,
      isActive: true
    });

    await Category.findByIdAndUpdate(categoryId, {
      categoryOffer: offer._id
    });

    logger.info(
      `ADMIN CATEGORY OFFER CREATED | CategoryId: ${categoryId} | OfferId: ${offer._id} | Discount: ${discount}`
    );

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: RESPONSE_MESSAGES.CATEGORY_OFFER_ADDED
    });
  } catch (error) {
    next(error);
  }
};

const loadEditCategoryOffer = async (req, res, next) => {
  try {
    const offer = await CategoryOffer
      .findById(req.params.id)
      .populate("category");

    if (!offer) {
      logger.warn(`CATEGORY OFFER NOT FOUND | OfferId: ${req.params.id}`);
      return res.redirect("/admin/category");
    }

    const categories = await Category.find({ isListed: true });
    res.render("editCategoryOffer", {
      offer,
      categories
    });
  } catch (error) {
    next(error);
  }
};

const updateCategoryOffer = async (req, res, next) => {
  try {
    const { startDate, endDate, discount } = req.body;
    const offerId = req.params.id;
    await CategoryOffer.findByIdAndUpdate(offerId, {
      startDate,
      endDate,
      discount
    });

    logger.info(
      `ADMIN CATEGORY OFFER UPDATED | OfferId: ${offerId} | Discount: ${discount}`
    );

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: RESPONSE_MESSAGES.CATEGORY_OFFER_UPDATED
    });
  } catch (error) {
    next(error);
  }
};

const deleteCategoryOffer = async (req, res, next) => {
  try {
    const offerId = req.params.id;
    await CategoryOffer.findByIdAndDelete(offerId);
    await Category.updateMany(
      { categoryOffer: offerId },
      { $set: { categoryOffer: null } }
    );

    logger.warn(
      `ADMIN CATEGORY OFFER DELETED | OfferId: ${offerId}`
    );

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: RESPONSE_MESSAGES.CATEGORY_OFFER_DELETED
    });
  } catch (error) {
    next(error);
  }
};

export default {
  loadAddCategoryOffer,
  addCategoryOffer,
  loadEditCategoryOffer,
  updateCategoryOffer,
  deleteCategoryOffer,
};
