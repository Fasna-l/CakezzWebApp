const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
    name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
 },

  discountType: {
    type: String,
    enum: ["percentage","flat"],
    default: "percentage",
  },

  discountValue: {
    type: Number,
    required: true,
    min: 1,
    //max: 100,
  },

  minPurchaseAmount: {
    type: Number,
    default: 0,
  },

  maxDiscountAmount: {
    type: Number,
    default: null,
  },

  startDate: {
    type: Date,
    default: Date.now,
  },

  expiryDate: {
    type: Date,
    required: true,
  },

  usageLimit: {
    type: Number,
    default: null,
  },

  usedCount: {
    type: Number,
    default: 0,
  },

  perUserLimit: {
    type: Number,
    //default:null
    default: 1,
  },
  assignedUser: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default:null
},


  usersUsed: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      count: {
        type: Number,
        default: 0,
      },
    },
  ],

  isActive: {
    type: Boolean,
    default: true,
  },
},{ timestamps: true });


const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = Coupon