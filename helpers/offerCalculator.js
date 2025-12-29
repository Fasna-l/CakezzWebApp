const Offer = require("../models/offerSchema");
const CategoryOffer = require("../models/categoryOfferSchema");

const calculateBestOffer = async (product, basePrice) => {
  let bestDiscount = 0;
  let appliedOfferType = null;

  const now = new Date();

  // 🔹 Product Offer
  if (product.productOffer) {
    const offer = await Offer.findOne({
      _id: product.productOffer,
      isActive: true,
      expiryDate: { $gte: now },
    });

    if (offer) {
      bestDiscount = offer.discount;
      appliedOfferType = "product";
    }
  }

  // 🔹 Category Offer
  if (product.category?.categoryOffer) {
    const catOffer = await CategoryOffer.findOne({
      _id: product.category.categoryOffer,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

    if (catOffer && catOffer.discount > bestDiscount) {
      bestDiscount = catOffer.discount;
      appliedOfferType = "category";
    }
  }

  const discountAmount = Math.round((basePrice * bestDiscount) / 100);
  const finalPrice = basePrice - discountAmount;

  return {
    discountPercentage: bestDiscount,
    discountAmount,
    finalPrice,
    appliedOfferType,
  };
};

module.exports = calculateBestOffer;
