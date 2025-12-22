const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    balance: {
      type: Number,
      default: 0,
      min: 0, // prevents negative balance
    },

    transactions: [
      {
        type: {
          type: String,
          enum: ["deposit", "withdrawal", "purchase", "refund", "referral"],
          required: true,
        },

        amount: {
          type: Number,
          required: true,
          min: 1,
        },

        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
          required: function () {
            return this.type === "purchase" || this.type === "refund";
          },
        },

        status: {
          type: String,
          enum: ["completed", "failed", "pending"],
          default: "completed",
        },

        description: {
          type: String,
          trim: true,
        },

        transactionId: {
          type: String, // Razorpay / PayPal reference (optional)
        },

        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

/* ======================================================
   🔄 Auto update updatedAt
====================================================== */
walletSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

/* ======================================================
   💰 Add Wallet Transaction Method
====================================================== */
walletSchema.methods.addTransaction = async function (transactionData) {
  const debitTypes = ["withdrawal", "purchase"];

  const amount = Number(transactionData.amount);
  // prevent insufficient balance
  if (debitTypes.includes(transactionData.type)) {
    if (this.balance < transactionData.amount) {
      throw new Error("Insufficient wallet balance");
    }
    this.balance -= amount;
  } else {
    this.balance += amount;
  }

  transactionData.amount = amount;
  this.transactions.push(transactionData);
  await this.save();
};

const Wallet = mongoose.model("Wallet",walletSchema);

module.exports = Wallet;
