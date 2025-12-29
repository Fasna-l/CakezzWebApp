const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Otp = require("../../models/otpSchema");  // import OTP Model
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
      // res.redirect("pageNotFound")
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
    // console.error("Google Authentication Error:", error);
    // res.redirect("/login?message=Google login failed&icon=warning");
  }
};

//Load Home Page

const loadHomepage = async (req, res, next) => {
  try {
    const user = req.session.user;
    const categories = await Category.find({ isListed: true });

    const cart = user ? await Cart.findOne({ user }).lean() : null;
    const cartCount = cart ? cart.items.length : 0;


    // ✅ Latest Products (with totalStock)
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


    // ✅ Best Products (Top priced items)
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


    // ✅ APPLY BEST OFFER (Product vs Category)
for (let product of latestProducts) {
  const basePrice = product.minPrice;
  const offer = await calculateBestOffer(product, basePrice);

  product.offerPercentage = offer.discountPercentage;
  product.appliedOfferType = offer.appliedOfferType;
  //product.finalPrice = offer.finalPrice;
}

for (let product of bestProducts) {
  const basePrice = product.maxPrice;
  const offer = await calculateBestOffer(product, basePrice);

  product.offerPercentage = offer.discountPercentage;
  product.appliedOfferType = offer.appliedOfferType;
  //product.finalPrice = offer.finalPrice;
}

    // ✅ Get User if logged in
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
    // console.log("Home page error:", error);
    // res.status(500).send("Server Error");
  }
};


//Load Login

const loadLogin = async (req,res,next)=>{
    try {
        if(!req.session.user){
            return res.render("login",{message:req.query.message || ""});
        }else{
            res.redirect("/")
        }
    } catch (error) {
        next(error);
        //res.redirect("pageNotFound")
    }
}

const login = async (req,res,next)=>{
    try {
        const {email,password} = req.body;

        const findUser = await User.findOne({isAdmin:0,email:email});

        if(!findUser){
            return res.render("login",{message:"We couldn't find an account with this email. Please try again or sign up."});
        }
        if(findUser.isBlocked){
            return res.render("login",{message:"Your account has been disabled. Please contact our team for assistance."})
        }

        const passwordMatch = await bcrypt.compare(password,findUser.password);

        if(!passwordMatch){
            return res.render("login",{message:"Incorrect Password"})
        }

        req.session.user = findUser._id
        //console.log(req.session.user)
        //console.log("session is there")
        res.redirect("/");

    } catch (error) {
      next(error);
        // console.error("login error",error);
        // res.render("login",{message:"login failed. Please try again later"});
    }
}
//Load Signup page

const loadSignup = async (req,res,next)=>{
    try {
        return res.render("signup")
    } catch (error) {
      next(error);
        // console.log("Signup page is not loading",error);
        // res.status(500).send("Server Error")
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

        // req.session.userOtp = otp;
        // req.session.userData = { name, email, password };

        // Store OTP in DB (Replace session-based storage)
        await Otp.deleteOne({email}); //remove old OTP if exists
        await Otp.create({email,otp});

        req.session.userData = { name, email, password , referralCode: referralCode || null};
        
        res.render("verify-otp");
        console.log("OTP Send",otp)

    } catch (error) {
        next(error);
        // console.error("signup error",error);
        // res.redirect("/pageNotFound")

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
        //const hashedPassword = await bcrypt.hash(password, 10);
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

    // 🔒 CHECK IF REFERRAL COUPON ALREADY EXISTS
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
        // console.error("OTP Verify Error:", error);
        // res.status(500).json({ success: false, message: "Server error" });
    }
};

//resendotp
const resendOtp = async(req,res,next)=>{
    try {

        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }

        const otp = generateOtp();
        // req.session.userOtp = otp;
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
        // console.error("Error resending otp",error);
        // res.status(500).json({success:false,message:"Internal Server Error. Please try again"})
    }
}

const logout = async (req,res,next) =>{
  try {
    req.session.user = null;
    return res.redirect("/login");
  } catch (error) {
    next(error);
    // console.log("Logout error",error);
    // res.redirect("/pageNotFound")
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
