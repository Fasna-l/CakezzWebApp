const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const mongoose = require("mongoose");

// Load Shop Page
const loadShoppage = async (req, res, next) => {
  try {
    const user = req.session.user;
    const categories = await Category.find({ isListed: true });

    const cart = user ? await Cart.findOne({ user }).lean() : null;
    const cartCount = cart ? cart.items.length : 0;


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

    let wishlistProductIds = [];

    if (req.session.user) {
      const wishlist = await Wishlist.findOne({ user: req.session.user }).lean();
      wishlistProductIds = wishlist
        ? wishlist.items.map(i => i.product.toString())
        : [];
    }
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
      maxPrice,
      cartCount,
      wishlistProductIds
    });

  } catch (error) {
    next(error);
    // console.log("Shopping page error:", error);
    // res.status(500).send("Server Error");
  }
};

const loadProductDetails = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const userId = req.session.user;

    const cart = userId ? await Cart.findOne({ user: userId }).lean() : null;
    const cartCount = cart ? cart.items.length : 0;

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

    let wishlistProductIds = [];

    if (req.session.user) {
      const wishlist = await Wishlist.findOne({ user: req.session.user }).lean();
      wishlistProductIds = wishlist
        ? wishlist.items.map(i => i.product.toString())
        : [];
    }
    res.render("product-details", {
      product,
      relatedProducts,
      user,
      cartCount,       // ✅ Now available in EJS for header
      wishlistProductIds
    });

  } catch (error) {
    next(error);
    // console.log("Product details error:", err);
    // res.redirect("/shop");
  }
};

// Load Review Page
const loadReviewPage = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    const user = req.session.user ? await User.findById(req.session.user) : null;

    if (!product) return res.status(404).send("Product Not Found");

    res.render("reviewPage", { product, user }); // ✅ correct folder path

  } catch (error) {
    next(error);
    // console.log(error);
    // res.redirect("/pageNotFound");
  }
};



// Submit Review
const submitReview = async (req, res, next) => {
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
  } catch (error) {
    next(error);
    // console.log(err);
    // res.redirect("/pageNotFound");
  }
};

module.exports = {
  loadShoppage,
  loadProductDetails,
  loadReviewPage,
  submitReview
};