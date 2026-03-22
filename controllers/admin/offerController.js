import Offer from "../../models/offerSchema.js";
import Product from "../../models/productSchema.js";
import logger from "../../utils/logger.js";
import HTTP_STATUS from "../../utils/httpStatus.js";
import RESPONSE_MESSAGES from "../../utils/responseMessages.js";

const loadAddOffer = async (req, res, next) => {
  try {
    const { productId } = req.query;
    if (!productId) {
      return res.redirect("/admin/products");
    }
    res.render("addOffer", { productId });
  } catch (error) {
    next(error);
  }
};

//ADD PRODUCT OFFER
const addOffer = async (req, res, next) => {
  try {
    const { offerName, discount, expiryDate, description, productId } = req.body;

    if (!offerName || !discount || !expiryDate || !productId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.MISSING_FIELDS
      });
    }
    // 1.Create offer
    const offer = await Offer.create({
      offerName,
      discount,
      expiryDate,
      description,
      isActive: true,
    });
    // 2.Attach offer to product
    await Product.findByIdAndUpdate(productId, {
      productOffer: offer._id,
    });

    logger.info(
      `ADMIN PRODUCT OFFER CREATED | ProductId: ${productId} | OfferId: ${offer._id} | Discount: ${discount}`
    );

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: RESPONSE_MESSAGES.OFFER_CREATED
    });
  } catch (error) {
    next(error);
  }
};

const loadEditOffer = async (req, res, next) => {
  try {
    const offerId = req.params.id;
    const product = await Product.findOne({ productOffer: offerId });
    const offer = await Offer.findById(offerId);
    if (!offer || !product) {
      return res.redirect("/admin/products");
    }
    res.render("editOffer", {
      offer,
      productId: product._id,
    });
  } catch (error) {
    next(error);
  }
};

const updateOffer = async (req, res, next) => {
  try {
    const { offerName, discount, expiryDate, description } = req.body;
    const offerId = req.params.id;

    const updated = await Offer.findByIdAndUpdate(
      offerId,
      { offerName, discount, expiryDate, description },
      { new: true }
    );

    if (!updated) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: RESPONSE_MESSAGES.OFFER_NOT_FOUND
      });
    }

    logger.info(
      `ADMIN PRODUCT OFFER UPDATED | OfferId: ${offerId} | Discount: ${discount}`
    );

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: RESPONSE_MESSAGES.OFFER_UPDATED
    });
  } catch (error) {
    next(error);
  }
};

const deleteOffer = async (req, res, next) => {
  try {
    const offerId = req.params.id;
    // Remove offer
    const offer = await Offer.findByIdAndDelete(offerId);
    if (!offer) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: RESPONSE_MESSAGES.OFFER_NOT_FOUND
      });
    }
    // Remove offer reference from products
    await Product.updateMany(
      { productOffer: offerId },
      { $set: { productOffer: null } }
    );

    logger.warn(
      `ADMIN PRODUCT OFFER DELETED | OfferId: ${offerId}`
    );

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: RESPONSE_MESSAGES.OFFER_DELETED
    });
  } catch (error) {
    next(error);
  }
};

export default {
  loadAddOffer,
  addOffer,
  loadEditOffer,
  updateOffer,
  deleteOffer,
};

