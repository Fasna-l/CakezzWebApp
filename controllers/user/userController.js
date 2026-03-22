import path from "path";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

import User from "../../models/userSchema.js";
import Category from "../../models/categorySchema.js";
import Product from "../../models/productSchema.js";
import Cart from "../../models/cartSchema.js";
import Otp from "../../models/otpSchema.js";
import Wallet from "../../models/walletSchema.js";
import Wishlist from "../../models/wishlistSchema.js";
import ReferralSettings from "../../models/referralSettingsSchema.js";
import Banner from "../../models/bannerSchema.js";
import Order from "../../models/orderSchema.js";
import { authLogger } from "../../utils/logger.js";
import HTTP_STATUS from "../../utils/httpStatus.js";
import RESPONSE_MESSAGES from "../../utils/responseMessages.js";

import { generateOtp } from "../../helpers/otpHelper.js";
import { sendVerificationEmail } from "../../helpers/emailHelper.js";
import { securePassword } from "../../helpers/passwordHelper.js";
import calculateBestOffer from "../../helpers/offerCalculator.js";

dotenv.config();

// ES module __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pageNotFound = async (req,res,next)=>{
    try {
        res.render("pageNotFound")
    } catch (error) {
      next(error);
    }
}

const googleAuth = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      throw new Error("User not found in req.user");
    }
    if (user.isBlocked) {
      return res.render("login", {
        message: "User is blocked by the admin",
        icon: "warning",
      });
    }

    req.session.user = user._id;
    authLogger.info(`GOOGLE LOGIN SUCCESS | UserId: ${user._id} | Email: ${user.email} | IP: ${req.ip}`);

     // ENSURE WALLET EXISTS FOR GOOGLE USER
    const walletExists = await Wallet.findOne({ userId: user._id });
    if (!walletExists) {
      await Wallet.create({ userId: user._id });
    }

    res.redirect("/?message=Logged in with Google successfully&icon=success");
  } catch (error) {
    next(error);
  }
};

const loadHomepage = async (req, res, next) => {
  try {
    const user = req.session.user;
    const categories = await Category.find({ isListed: true });

    const cart = user ? await Cart.findOne({ user }).lean() : null;
    const cartCount = cart ? cart.items.length : 0;

    // Latest Products (with totalStock)
    let latestProducts = await Product.aggregate([
      { $match: { isBlocked: false, category: { $in: categories.map(c => c._id) } } },

      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" },

      {
        $addFields: {
          totalStock: { $sum: "$variants.stock" },
          minPrice: { $min: "$variants.price" }
        }
      },
      { $sort: { createdAt: -1 } },
      { $limit: 4 }
    ]);

    // Best Products (Top priced items)
    let bestProducts = await Order.aggregate([
      { $unwind: "$items" },

      {
        $group: {
          _id: "$items.productId",
          totalSold: { $sum: "$items.quantity" }
        }
      },

      { $sort: { totalSold: -1 } },

      { $limit: 10 },

      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product"
        }
      },

      { $unwind: "$product" },

      {
        $match: {
          "product.isBlocked": false
        }
      },

      {
        $replaceRoot: { newRoot: "$product" }
      }
    ]);

    // APPLY BEST OFFER (Product vs Category)
    for (let product of latestProducts) {

      const fullProduct = await Product.findById(product._id)
        .populate("category")
        .lean();

      const basePrice = product.minPrice;

      const offer = await calculateBestOffer(fullProduct, basePrice);

      product.offerPercentage = offer.discountPercentage;
      product.appliedOfferType = offer.appliedOfferType;
    }

    for (let product of bestProducts) {

      const fullProduct = await Product.findById(product._id)
        .populate("category")
        .lean();

      const basePrice = product.variants[product.variants.length - 1]?.price || 0;

      const offer = await calculateBestOffer(fullProduct, basePrice);

      product.offerPercentage = offer.discountPercentage;
      product.appliedOfferType = offer.appliedOfferType;
    }

    //  Get User if logged in
    const userData = user ? await User.findById(user) : null;

    let wishlistProductIds = [];
    if (req.session.user) {
      const wishlist = await Wishlist.findOne({ user: req.session.user }).lean();
      wishlistProductIds = wishlist
        ? wishlist.items.map(i => i.product.toString())
        : [];
    }

    // Get banners
    const banners = await Banner.find().sort({ createdAt: -1 });

    return res.render("home", {
      user: userData,
      latestProducts,
      bestProducts,
      cartCount,
      wishlistProductIds,
      banners
    });
  } catch (error) {
    next(error);
  }
};

const loadLogin = async (req,res,next)=>{
    try {
        if(req.session.user){
            return res.redirect("/");
        }

        const message = req.session.loginError;
        delete req.session.loginError;  // clear after showing once

        return res.render("login",{message});

    } catch (error) {
        next(error);
    }
}

const login = async (req,res,next)=>{
    try {
        const {email,password} = req.body;
        const findUser = await User.findOne({isAdmin:0,email:email});
        
        if(!findUser){
          authLogger.warn(`LOGIN FAILED | Email: ${email} | Reason: User not found | IP: ${req.ip}`);
          req.session.loginError = "We couldn't find an account with this email. Please try again or sign up.";
          return res.redirect("/login");
        }
        
        if(findUser.isBlocked){
          authLogger.warn(`LOGIN BLOCKED | UserId: ${findUser._id} | IP: ${req.ip}`);
          req.session.loginError = "Your account has been disabled. Please contact our team for assistance.";
          return res.redirect("/login");
        }

        const passwordMatch = await bcrypt.compare(password,findUser.password);

        if(!passwordMatch){
          authLogger.warn(`LOGIN FAILED | UserId: ${findUser._id} | Reason: Wrong password | IP: ${req.ip}`);
          req.session.loginError = "Incorrect Password";
          return res.redirect("/login");
        }

        req.session.user = findUser._id
        authLogger.info(`LOGIN SUCCESS | UserId: ${findUser._id} | Email: ${email} | IP: ${req.ip}`);
        return res.redirect("/")

    } catch (error) {
      next(error);
    }
}

const loadSignup = async (req,res,next)=>{
    try {
      const referralCode = req.query.code || "";
      return res.render("signup", { referralCode });
    } catch (error) {
      next(error);
    }
}

const signup = async (req,res,next) =>{
    try {
        const {name,email,password,confirmPassword, referralCode} = req.body;
        if(password !== confirmPassword){
            return res.render("signup",{message:RESPONSE_MESSAGES.PASSWORD_MISMATCH});
        }
        const findUser = await User.findOne({email});
        if(findUser){
            return res.render("signup",{
                message:RESPONSE_MESSAGES.EMAIL_ALREADY_EXISTS,
                icon: "warning",
            });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email,otp,"Verify your account");
        if (!emailSent) {
            console.log("Email sending failed");
            return res.render("signup", {
                message: RESPONSE_MESSAGES.EMAIL_SEND_FAILED,
                icon: "warning",
            });
        }
        // Store OTP in DB (Replace session-based storage)
        await Otp.deleteOne({email}); //remove old OTP if exists
        await Otp.create({email,otp});

        req.session.userData = { name, email, password , referralCode: referralCode || null};
        res.render("verify-otp");
        console.log("OTP Send",otp)

    } catch (error) {
        next(error);
    }
}

const verifyOtp = async (req, res,next) => {
    try {
        const enteredOtp = req.body.otp;
        const { email, name, password, referralCode} = req.session.userData || {};

        if (!email) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: RESPONSE_MESSAGES.SESSION_EXPIRED
          });
        }

        // Fetch OTP from DB
        const otpRecord = await Otp.findOne({ email });

        if (!otpRecord) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: RESPONSE_MESSAGES.OTP_EXPIRED
          });
        }
        if (otpRecord.otp !== enteredOtp) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
              success: false,
              message: RESPONSE_MESSAGES.OTP_INVALID
            });
        }
        //  Save user after OTP match
        const hashedPassword = await securePassword(password);
        // Generate referral code for NEW user
        const generateReferralCode = () =>
          Math.random().toString(36).substring(2, 8).toUpperCase();
        
        let referrerUser = null;
        if (referralCode) {
          referrerUser = await User.findOne({ referralCode });
        }
        const newUser = new User({ name, email, password: hashedPassword ,referralCode: generateReferralCode(), referredBy: referrerUser ? referrerUser._id : null });
        await newUser.save();
        authLogger.info(`NEW USER REGISTERED | UserId: ${newUser._id} | Email: ${newUser.email} | IP: ${req.ip}`);

        // ================= REFERRAL REWARD =================
      // AUTO-CREATE WALLET (STEP 1)
      await Wallet.create({
        userId: newUser._id,
        balance: 0
      });

      //Referral signup reward (A give code to B : this is for B)
      if(referrerUser) {
        const wallet = await Wallet.findOne({ userId: newUser._id});

        const settings = await ReferralSettings.findOne();

        const rewardAmount = settings?.refereeReward || 50;

        await wallet.addTransaction({
          type:"referral",
          amount: rewardAmount,
          description:"Referral signup bonus"
        });
      }

      req.session.user = newUser._id;
      console.log("User data saved successfully");

      // Remove OTP from DB
      await Otp.deleteOne({ email });
      res.status(HTTP_STATUS.OK).json({
        success: true,
        redirectUrl: "/login"
      });
    } catch (error) {
      next(error);
    }
};

const resendOtp = async(req,res,next)=>{
    try {

        const {email} = req.session.userData;
        if(!email){
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
              success:false,
              message: RESPONSE_MESSAGES.SESSION_EXPIRED
            });
        }

        const otp = generateOtp();
        await Otp.deleteOne({email});
        await Otp.create({email,otp});

        const emailSent = await sendVerificationEmail(email,otp,"Your OTP for Account Verification")
        if(emailSent){
            console.log("Resend OTP:",otp);
            res.status(HTTP_STATUS.OK).json({
              success:true,
              message: RESPONSE_MESSAGES.OTP_RESENT
            });
        }else{
          res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success:false,
            message: RESPONSE_MESSAGES.EMAIL_SEND_FAILED
          });
        }
    } catch (error) {
      next(error);
    }
}

const logout = async (req,res,next) =>{
  try {
    authLogger.info(`LOGOUT | UserId: ${req.session.user} | IP: ${req.ip}`);
    req.session.user = null;
    return res.redirect("/login");
  } catch (error) {
    next(error);
  }
}

const loadContact = async (req,res,next)=>{
    try{
        res.render("contact")
    }catch(error){
        next(error)
    }
}

const loadAbout = async (req,res,next)=>{
  try{
      res.render("about")
  }catch(error){
      next(error)
  }
}

export default {
  loadHomepage,
  pageNotFound,
  googleAuth,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
  loadContact,
  loadAbout
};
