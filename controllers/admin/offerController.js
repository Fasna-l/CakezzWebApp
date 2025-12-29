const Offer = require("../../models/offerSchema");
const Product = require("../../models/productSchema");

/* ===============================
   LOAD ADD OFFER PAGE
   (Opened from Product page)
================================ */
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

/* ===============================
   ADD PRODUCT OFFER
================================ */
const addOffer = async (req, res, next) => {
  try {
    const { offerName, discount, expiryDate, description, productId } = req.body;

    if (!offerName || !discount || !expiryDate || !productId) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    // 1️⃣ Create offer
    const offer = await Offer.create({
      offerName,
      discount,
      expiryDate,
      description,
      isActive: true,
    });

    // 2️⃣ Attach offer to product
    await Product.findByIdAndUpdate(productId, {
      productOffer: offer._id,
    });

    res.status(201).json({
      success: true,
      message: "Offer created & assigned to product",
    });
  } catch (error) {
    next(error);
  }
};

/* ===============================
   LOAD EDIT OFFER PAGE
================================ */
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

/* ===============================
   UPDATE OFFER
================================ */
const updateOffer = async (req, res, next) => {
  try {
    const { offerId, offerName, discount, expiryDate, description } = req.body;

    const updated = await Offer.findByIdAndUpdate(
      offerId,
      { offerName, discount, expiryDate, description },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    res.json({
      success: true,
      message: "Offer updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/* ===============================
   DELETE OFFER
================================ */
const deleteOffer = async (req, res, next) => {
  try {
    const offerId = req.params.id;

    // Remove offer
    const offer = await Offer.findByIdAndDelete(offerId);
    if (!offer) {
      return res.status(404).json({ success: false });
    }

    // Remove offer reference from products
    await Product.updateMany(
      { productOffer: offerId },
      { $set: { productOffer: null } }
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  loadAddOffer,
  addOffer,
  loadEditOffer,
  updateOffer,
  deleteOffer,
};

