const mongoose = require("mongoose");

const categoryOfferSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      unique: true,
    },

    discount: {
      type: Number,
      required: true,
      min: 1,
      max: 90,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const CategoryOffer = mongoose.model("CategoryOffer", categoryOfferSchema);
module.exports = CategoryOffer 