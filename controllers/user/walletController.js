import Wallet from "../../models/walletSchema.js";
import User from "../../models/userSchema.js";
import razorpay from "../../config/razorpay.js";
import crypto from "crypto";
import HTTP_STATUS from "../../utils/httpStatus.js";
import RESPONSE_MESSAGES from "../../utils/responseMessages.js";

const loadWallet = async (req, res, next) => {
  try {
    const userId = req.session.user;
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0 });
    }

    const user = await User.findById(userId);

    res.render("wallet", { wallet,user });
  } catch (error) {
    next(error);
  }
};

const loadWalletHistory = async (req, res, next) => {
  try {
    const userId = req.session.user;
    let wallet = await Wallet.findOne({ userId }).populate("transactions.orderId").lean();
    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0 });
    }

    const user = await User.findById(userId);
    //Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    //Sort transactions (latest first)
    const sortedTransactions = wallet.transactions
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalTransactions = sortedTransactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);

    //Paginated transactions
    const paginatedTransactions = sortedTransactions.slice(
      skip,
      skip + limit
    );
    
    res.render("wallet-history", { 
        wallet,
        user,
        transactions: paginatedTransactions,
        currentPage: page,
        totalPages
    });
  } catch (error) {
    next(error);
  }
};

//adding money to wallet
const createWalletRechargeOrder = async (req, res, next) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 1) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.WALLET_MIN
      });
    }
    if (amount > 500000) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.WALLET_MAX
      });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `wallet_${Date.now()}`
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      razorpayOrder,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    next(error);
  }
};

//Verify payment & ADD money to wallet
const verifyWalletRecharge = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount
    } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign !== razorpay_signature) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.INVALID_REQUEST
      });
    }

    const wallet = await Wallet.findOne({ userId: req.session.user });

    if (!wallet) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.INVALID_REQUEST
      });
    }
    await wallet.addTransaction({
      type: "deposit",
      amount: Number(amount),
      description: "Wallet recharge"
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: RESPONSE_MESSAGES.SUCCESS
    });
  } catch (error) {
    next(error);
  }
};

export default {
  loadWallet,
  loadWalletHistory,
  createWalletRechargeOrder,
  verifyWalletRecharge
};
