const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Otp = require("../../models/otpSchema");  // import OTP Model
const mongoose = require("mongoose");
const env = require("dotenv").config();
const bcrypt = require("bcrypt");
const { generateOtp } = require("../../helpers/otpHelper");
const { sendVerificationEmail } = require("../../helpers/emailHelper");
const { securePassword } = require("../../helpers/passwordHelper");

const pageNotFound = async (req,res)=>{
    try {
        res.render("pageNotFound")
    } catch (error) {
        res.redirect("pageNotFound")
    }
}

const googleAuth = async (req, res) => {
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
    res.redirect("/?message=Logged in with Google successfully&icon=success");
  } catch (error) {
    console.error("Google Authentication Error:", error);
    res.redirect("/login?message=Google login failed&icon=warning");
  }
};

//Load Home Page

const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user;
    const categories = await Category.find({ isListed: true });

    // ✅ Latest Products (with totalStock)
    let latestProducts = await Product.aggregate([
      { $match: { isBlocked: false, category: { $in: categories.map(c => c._id) } } },
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
        $addFields: {
          totalStock: { $sum: "$variants.stock" },
          maxPrice: { $max: "$variants.price" }
        }
      },
      { $sort: { maxPrice: -1 } },
      { $limit: 8 }
    ]);

    // ✅ Get User if logged in
    const userData = user ? await User.findById(user) : null;

    return res.render("home", {
      user: userData,
      latestProducts,
      bestProducts
    });
  } catch (error) {
    console.log("Home page error:", error);
    res.status(500).send("Server Error");
  }
};


//Load Login

const loadLogin = async (req,res)=>{
    try {
        if(!req.session.user){
            return res.render("login",{message:req.query.message || ""});
        }else{
            res.redirect("/")
        }
    } catch (error) {
        res.redirect("pageNotFound")
    }
}

const login = async (req,res)=>{
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
        console.error("login error",error);
        res.render("login",{message:"login failed. Please try again later"});
    }
}
//Load Signup page

const loadSignup = async (req,res)=>{
    try {
        return res.render("signup")
    } catch (error) {
        console.log("Signup page is not loading",error);
        res.status(500).send("Server Error")
    }
}


const signup = async (req,res) =>{
    try {
        
        const {name,email,password,confirmPassword} = req.body;

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

        req.session.userData = { name, email, password };
        
        res.render("verify-otp");
        console.log("OTP Send",otp)

    } catch (error) {
        
        console.error("signup error",error);
        res.redirect("/pageNotFound")

    }
}

const verifyOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        const { email, name, password } = req.session.userData || {};

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
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        req.session.user = newUser._id;
        console.log("User data saved successfully");

        // Remove OTP from DB
        await Otp.deleteOne({ email });

        res.json({ success: true, redirectUrl: "/login" });

    } catch (error) {
        console.error("OTP Verify Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

//resendotp
const resendOtp = async(req,res)=>{
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
        console.error("Error resending otp",error);
        res.status(500).json({success:false,message:"Internal Server Error. Please try again"})
    }
}

const logout = async (req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error",err.message);
                return res.redirect("/pageNotFound");
            }
            return res.redirect("/login")
        })

    } catch (error) {
        
        console.log("Logout error",error);
        res.redirect("/pageNotFound")

    }
}

// Load Shop Page
const loadShoppage = async (req, res) => {
  try {
    const user = req.session.user;
    const categories = await Category.find({ isListed: true });

    // ✅ Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = 8;
    let skip = (page - 1) * limit;

    // ✅ Filters
    let search = req.query.search || "";
    let categoryFilter = req.query.category || "";
    let sort = req.query.sort || "";
    let priceRange = req.query.priceRange || ""; 
    // let minPrice = parseInt(req.query.minPrice) || 0;
    // let maxPrice = parseInt(req.query.maxPrice) || 100000;
    let minPrice = 0, maxPrice = 100000;

    // ✅ Basic Filter
    let filter = {
      isBlocked: false,
      productName: { $regex: search, $options: "i" },
    };

    if (categoryFilter) {
      filter.category = new mongoose.Types.ObjectId(categoryFilter);
    }

    if (priceRange) {
        const [min, max] = priceRange.split("-").map(Number);
        minPrice = min;
        maxPrice = max;
    }

    // ✅ Total product count BEFORE pagination
    const totalProducts = await Product.countDocuments(filter);

    // ✅ Aggregation Pipeline
    const pipeline = [
      { $match: filter },

      // Add min & max price based on variants
      {
        $addFields: {
          minPrice: { $ifNull: [{ $min: "$variants.price" }, 0] },
          maxPrice: { $ifNull: [{ $max: "$variants.price" }, 0] },
          totalStock: { $sum: "$variants.stock" }
        }
      },

      // ✅ Filter products by chosen price range
      { $match: { minPrice: { $gte: minPrice, $lte: maxPrice } } }
    ];

    // ✅ Sorting Logic
    if (sort === "priceAsc") pipeline.push({ $sort: { minPrice: 1 } });
    else if (sort === "priceDesc") pipeline.push({ $sort: { minPrice: -1 } });
    else if (sort === "az") pipeline.push({ $sort: { productName: 1 } });
    else if (sort === "za") pipeline.push({ $sort: { productName: -1 } });
    else pipeline.push({ $sort: { createdAt: -1 } });

    // ✅ Pagination
    pipeline.push({ $skip: skip }, { $limit: limit });

    // ✅ Lookup Category
    pipeline.push({
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "category"
      }
    });

    pipeline.push({
      $unwind: { path: "$category", preserveNullAndEmptyArrays: true }
    });

    const products = await Product.aggregate(pipeline);
    const totalPages = Math.ceil(totalProducts / limit);

    // ✅ Render
    return res.render("shop", {
      user: user ? await User.findById(user) : null,
      products,
      categories,
      currentPage: page,
      totalPages,
      totalProducts,
      search,
      categoryFilter,
      sort,
      priceRange,
      minPrice,
      maxPrice
    });

  } catch (error) {
    console.log("Shopping page error:", error);
    res.status(500).send("Server Error");
  }
};

const loadProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.session.user;

    const product = await Product.findById(productId)
      .populate("category")
      .lean();

    if (!product || product.isBlocked) {
      return res.redirect("/shop");
    }

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
      isBlocked: false
    }).limit(4).lean();

    const user = userId ? await User.findById(userId).lean() : null; // ✅ added

    res.render("product-details", {
      product,
      relatedProducts,
      user       // ✅ Now available in EJS for header
    });

  } catch (err) {
    console.log("Product details error:", err);
    res.redirect("/shop");
  }
};

// Load Review Page
const loadReviewPage = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    const user = req.session.user ? await User.findById(req.session.user) : null;

    if (!product) return res.status(404).send("Product Not Found");

    res.render("reviewPage", { product, user }); // ✅ correct folder path

  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound");
  }
};



// Submit Review
const submitReview = async (req, res) => {
  try {
    const { rating, review } = req.body;
    const productId = req.params.id;

    // ✅ Get logged-in user details
    const userData = await User.findById(req.session.user);

    await Product.findByIdAndUpdate(productId, {
      $push: {
        reviews: {
          user: userData._id,         // Save user ID
          name: userData.name,        // ✅ Save user name
          rating,
          review,
          date: new Date()
        }
      }
    });

    res.redirect("/product/" + productId);
  } catch (err) {
    console.log(err);
    res.redirect("/pageNotFound");
  }
};

//Load Account page(Profile Page)
const loadAccountPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId).lean();

    // Fetch addresses or orders later
    res.render("account", {
      user
    });
  } catch (error) {
    console.error("Account Page Error:", error);
    res.redirect("/pageNotFound");
  }
};

// Load Edit Profile Page
const loadEditProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);
    if (!user) return res.redirect("/login");

    res.render("edit-profile", { user });
  } catch (error) {
    console.error("Error loading edit profile page:", error);
    res.redirect("/pageNotFound");
  }
};

// ✅ Update Profile - POST
const updateProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const { name, email } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.redirect("/login");

    // 🧠 Prepare update data
    const updateData = { name };

    // 🖼️ Handle new profile image upload
    if (req.file) {
      console.log("🧩 File received from Multer:", req.file.originalname);

      // ✅ Ensure the profile folder exists
      const profileDir = path.join(__dirname, "../../public/uploads/profile");
      if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
      }

      // ✅ Create a unique filename
      const filename = `${Date.now()}-${req.file.originalname}`;
      const uploadPath = path.join(profileDir, filename);

      try {
        // ✅ Compress & save image using Sharp
        await sharp(req.file.buffer)
          .resize(300, 300, { fit: "cover" })
          .jpeg({ quality: 85 })
          .toFile(uploadPath);

        // ✅ Delete old profile image if it exists
        if (user.profileImage) {
          const oldPath = path.join(profileDir, user.profileImage);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        // ✅ Save new image filename to DB
        updateData.profileImage = filename;
        console.log("✅ Profile image saved successfully:", filename);
      } catch (err) {
        console.error("❌ Sharp image processing failed:", err);
      }
    } else {
      console.warn("⚠️ No image file received from frontend.");
    }

    // ✉️ Handle email change (OTP later)
    if (email !== user.email) {
      req.session.tempProfileData = {
        userId,
        name,
        email,
        profileImage: updateData.profileImage || user.profileImage,
      };
      console.log("Email changed — OTP verification to be added soon.");
    } else {
      updateData.email = email;
    }

    // 🧾 Save to database
    await User.findByIdAndUpdate(userId, updateData);

    console.log("Profile updated successfully!");
    res.redirect("/account");
  } catch (error) {
    console.error("Profile update error:", error);
    res.redirect("/pageNotFound");
  }
};


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
    loadShoppage,
    loadProductDetails,
    loadReviewPage,
    submitReview,
    loadAccountPage,
    loadEditProfile,
    updateProfile
}
