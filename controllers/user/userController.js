const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Otp = require("../../models/otpSchema");  
const Wallet = require("../../models/walletSchema");
const Wishlist = require("../../models/wishlistSchema");
const mongoose = require("mongoose");
const env = require("dotenv").config();
const bcrypt = require("bcrypt");
const { generateOtp } = require("../../helpers/otpHelper");
const { sendVerificationEmail } = require("../../helpers/emailHelper");
const { securePassword } = require("../../helpers/passwordHelper");
const calculateBestOffer = require("../../helpers/offerCalculator");

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
    let bestProducts = await Product.aggregate([
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
          maxPrice: { $max: "$variants.price" }
        }
      },
      { $sort: { maxPrice: -1 } },
      { $limit: 8 }
    ]);

    // APPLY BEST OFFER (Product vs Category)
    for (let product of latestProducts) {
      const basePrice = product.minPrice;
      const offer = await calculateBestOffer(product, basePrice);
      product.offerPercentage = offer.discountPercentage;
      product.appliedOfferType = offer.appliedOfferType;
    }

    for (let product of bestProducts) {
      const basePrice = product.maxPrice;
      const offer = await calculateBestOffer(product, basePrice);
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

    return res.render("home", {
      user: userData,
      latestProducts,
      bestProducts,
      cartCount,
      wishlistProductIds
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
          req.session.loginError = "We couldn't find an account with this email. Please try again or sign up.";
          return res.redirect("/login");
        }
        if(findUser.isBlocked){
          req.session.loginError = "Your account has been disabled. Please contact our team for assistance.";
          return res.redirect("/login");
        }

        const passwordMatch = await bcrypt.compare(password,findUser.password);

        if(!passwordMatch){
          req.session.loginError = "Incorrect Password";
          return res.redirect("/login");
            //return res.render("login",{message:"Incorrect Password"})
        }

        req.session.user = findUser._id
        return res.redirect("/")
        //res.redirect("/");

    } catch (error) {
      next(error);
    }
}

const loadSignup = async (req,res,next)=>{
    try {
        return res.render("signup")
    } catch (error) {
      next(error);
    }
}

const signup = async (req,res,next) =>{
    try {
        const {name,email,password,confirmPassword, referralCode} = req.body;
        if(password !== confirmPassword){
            return res.render("signup",{message:"Passwords do not match"});
        }
        const findUser = await User.findOne({email});
        if(findUser){
            return res.render("signup",{
                message:"User with this email already exists",
                icon: "warning",
            });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email,otp,"Verify your account");
        if (!emailSent) {
            console.log("Email sending failed");
            return res.render("signup", {
                message: "Failed to send OTP. Please try again.",
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
            return res.status(400).json({ success: false, message: "Session expired. Please signup again." });
        }

        // Fetch OTP from DB
        const otpRecord = await Otp.findOne({ email });

        if (!otpRecord) {
            return res.json({ success: false, message: "OTP expired or not found. Please resend." });
        }
        if (otpRecord.otp !== enteredOtp) {
            return res.json({ success: false, message: "Invalid OTP" });
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

        // ================= REFERRAL REWARD =================
        if (referralCode) {
          const referrer = await User.findOne({ referralCode });

          if (referrer) {
          const Coupon = require("../../models/couponSchema");

        // CHECK IF REFERRAL COUPON ALREADY EXISTS
          const existingReferralCoupon = await Coupon.findOne({
            assignedUser: referrer._id,
            description: "Referral reward coupon"
          });

          if (!existingReferralCoupon) {
            const couponCode =
              "REF-" + Math.random().toString(36).substring(2, 8).toUpperCase();

            await Coupon.create({
              name: "Referral Coupon",
              code: couponCode,
              description: "Referral reward coupon",
              discountType: "percentage",
              discountValue: 10,
              minPurchaseAmount: 500,
              maxDiscountAmount: 200,
              expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              isActive: true,
              usageLimit: 1,
              perUserLimit: 1,
              assignedUser: referrer._id
            });
          }
        }
      }
      // AUTO-CREATE WALLET (STEP 1)
      await Wallet.create({
        userId: newUser._id,
        balance: 0
      });

      req.session.user = newUser._id;
      console.log("User data saved successfully");

      // Remove OTP from DB
      await Otp.deleteOne({ email });
      res.json({ success: true, redirectUrl: "/login" });
    } catch (error) {
      next(error);
    }
};

const resendOtp = async(req,res,next)=>{
    try {

        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }

        const otp = generateOtp();
        await Otp.deleteOne({email});
        await Otp.create({email,otp});

        const emailSent = await sendVerificationEmail(email,otp,"Your OTP for Account Verification")
        if(emailSent){
            console.log("Resend OTP:",otp);
            res.status(200).json({success:true,message:"OTP Resend Successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to resend OTP. Please try again"});
        }
    } catch (error) {
      next(error);
    }
}

const logout = async (req,res,next) =>{
  try {
    req.session.user = null;
    return res.redirect("/login");
  } catch (error) {
    next(error);
  }
}

module.exports = {
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
}
