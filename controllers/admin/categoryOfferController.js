const CategoryOffer = require("../../models/categoryOfferSchema");
const Category = require("../../models/categorySchema");

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
      return res.json({
        success: false,
        message: "An active offer already exists for this category"
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

    res.json({ success: true });
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
    const { offerId, startDate, endDate, discount } = req.body;
    await CategoryOffer.findByIdAndUpdate(offerId, {
      startDate,
      endDate,
      discount
    });

    res.json({ success: true });
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

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  loadAddCategoryOffer,
  addCategoryOffer,
  loadEditCategoryOffer,
  updateCategoryOffer,
  deleteCategoryOffer,
};
