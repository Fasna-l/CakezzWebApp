import mongoose from "mongoose";
const { Schema } = mongoose;

const cartSchema = new Schema({

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },

      size: {
        type: String,  // 1kg / 2kg / 3kg
        required: true,
      },

      quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
      },

      priceAtAdd: {
        type: Number, // snapshot of price at that time
        required: true,
      },

      stockAtAdd: {
        type: Number,
        required: true,
      },

      addedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  totalAmount: {
    type: Number,
    default: 0,
  },
},
  {
    timestamps: true,
  }
);

// auto calculate cart total
cartSchema.pre("save", function (next) {
  this.totalAmount = this.items.reduce((sum, item) => {
    return sum + item.priceAtAdd * item.quantity;
  }, 0);

  next();
});

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;