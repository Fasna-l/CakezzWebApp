const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  addresses: [
    {
      phone: {
        type: String,
        required: true
      },
      streetAddress: {
        type: String, // Apartment / Door No / Street
        required: true
      },
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      district: {
        type: String,
        required:true
      },
      pincode: {
        type: String,
        required: true
      },
      landmark: {
        type: String
      },
      addressType: {
        type: String,
        enum: ["Home", "Work", "Other"],
        default: "Home"
      },
      isDefault: {
        type: Boolean,
        default: false
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ]
});

const Address = mongoose.model("Address", addressSchema);

module.exports = Address;
