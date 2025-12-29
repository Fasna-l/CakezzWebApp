const mongoose = require("mongoose");
const crypto = require("crypto");

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
      productName: { type: String, required: true },
      productImage: { type: String, required: true },
      size: { type: String },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true, min: 1 },

      status: {
        type: String,
        enum: ["Pending","Processing","Packed","Placed","Shipped","Out for Delivery","Delivered","Cancelled","Return Requested","Returned","Rejected","Return Rejected"],
        default: "Pending",
      },

      cancellationReason: { type: String },
      cancelledAt: { type: Date },

      returnReason: { type: String },
      returnStatus: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending",
      },
      returnedAt: { type: Date },

      refundAmount: { type: Number, default: 0 },
      refundStatus: { type: String, enum: ["Pending", "Processed"], default: "Pending" },
    },
  ],

  shippingAddress: {
    addressType: { type: String, required: true },
    streetAddress: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
    state: { type: String, required: true },
    landmark: { type: String },
    pinCode: { type: String, required: true },
    phoneNumber: { type: String, required: true },
  },

  subTotal: { type: Number, required: true },
  offerDiscount: { type: Number, default: 0 },
  taxAmount: { type: Number, required: true },
  shippingCharge: { type: Number, default: 0 },
  couponDiscount: { type: Number, default: 0 },

  totalAmount: { type: Number, required: true },

  walletUsed: {
    type: Number,
    default: 0,
  },

  payableAmount: {
    type: Number,
    default: 0,
  },

  paymentMethod: {
    type: String,
    enum: ["COD", "RAZORPAY", "WALLET"],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Processing", "Paid", "Failed"],
    default: "Pending",
  },

  paymentDetails: {
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
  },

  orderStatus: {
  type: String,
  enum: [
    "Payment Pending",
    "Payment Failed",
    "Pending",
    "Processing",
    "Packed",
    "Placed",
    "Shipped",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
    "Return Requested",
    "Returned",
    "Rejected",
    "Return Rejected"
  ],
  default: "Pending",
},


  cancellationReason: { type: String },
  cancelledAt: { type: Date },

  statusHistory: [
    {
      status: { type: String, required: true },
      comment: String,
      date: { type: Date, default: Date.now },
    },
  ],

  returnRequests: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      reason: { type: String },
      status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
      requestDate: { type: Date, default: Date.now },
    },
  ],

  orderDate: { type: Date, default: Date.now },
  deliveryDate: { type: Date },
});

orderSchema.pre("validate", function (next) {
  if (!this.orderId) {
    this.orderId = "ORD-" + crypto.randomBytes(3).toString("hex").toUpperCase();
  }
  next();
});


const Order = mongoose.model("Order", orderSchema);
module.exports = Order