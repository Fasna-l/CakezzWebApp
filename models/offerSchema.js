const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    offerName: {
      type: String,
      required: true,
      trim: true,
    },

    discount: {
      type: Number, // percentage
      required: true,
      min: 1,
      max: 90,
    },

    expiryDate: {
      type: Date,
      required: true,
    },

    description: {
      type: String,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  { timestamps: true }
);

const Offer = mongoose.model("Offer", offerSchema);
module.exports = Offer