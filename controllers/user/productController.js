import User from "../../models/userSchema.js";
import Product from "../../models/productSchema.js";
import Category from "../../models/categorySchema.js";
import Cart from "../../models/cartSchema.js";
import Wishlist from "../../models/wishlistSchema.js";
import calculateBestOffer from "../../helpers/offerCalculator.js";
import mongoose from "mongoose";

// Load Shop Page
const loadShoppage = async (req, res, next) => {
  try {
    const user = req.session.user;
    const categories = await Category.find({ isListed: true });

    const cart = user ? await Cart.findOne({ user }).lean() : null;
    const cartCount = cart ? cart.items.length : 0;

    let page = parseInt(req.query.page) || 1;
    let limit = 8;
    let skip = (page - 1) * limit;

    let search = req.query.search || "";
    let categoryFilter = req.query.category || "";
    let sort = req.query.sort || "";
    let priceRange = req.query.priceRange || ""; 
    let minPrice = 0, maxPrice = 100000;

    // Basic Filter
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

    //  Total product count BEFORE pagination
    const totalProducts = await Product.countDocuments(filter);

    // Aggregation Pipeline
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

      // Filter products by chosen price range
      { $match: { minPrice: { $gte: minPrice, $lte: maxPrice } } }
    ];

    //  Sorting Logic
    if (sort === "priceAsc") pipeline.push({ $sort: { minPrice: 1 } });
    else if (sort === "priceDesc") pipeline.push({ $sort: { minPrice: -1 } });
    else if (sort === "az") pipeline.push({ $sort: { productName: 1 } });
    else if (sort === "za") pipeline.push({ $sort: { productName: -1 } });
    else pipeline.push({ $sort: { createdAt: -1 } });

    //  Pagination
    pipeline.push({ $skip: skip }, { $limit: limit });

    //  Lookup Category
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
    
    //  APPLY BEST OFFER (Product vs Category)
for (let product of products) {
  const basePrice = product.minPrice;
  const offer = await calculateBestOffer(product, basePrice);

  product.offerPercentage = offer.discountPercentage;
  product.appliedOfferType = offer.appliedOfferType;
}

    const totalPages = Math.ceil(totalProducts / limit);

    let wishlistProductIds = [];
    if (req.session.user) {
      const wishlist = await Wishlist.findOne({ user: req.session.user }).lean();
      wishlistProductIds = wishlist
        ? wishlist.items.map(i => i.product.toString())
        : [];
    }
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

          //  APPLY BEST OFFER
    const basePrice = product.variants[0].price;
    const offer = await calculateBestOffer(product, basePrice);

    product.offerPercentage = offer.discountPercentage;
    product.appliedOfferType = offer.appliedOfferType;

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
      isBlocked: false
    })
    .populate("category")
    .limit(4)
    .lean();


    for (let p of relatedProducts) {
      const basePrice = p.variants[0]?.price || 0;
      const offer = await calculateBestOffer(p, basePrice);

      p.offerPercentage = offer.discountPercentage;
      p.appliedOfferType = offer.appliedOfferType
    }

    const user = userId ? await User.findById(userId).lean() : null; 

    let wishlistItems = [];

    if (req.session.user) {
      const wishlist = await Wishlist.findOne({ user: req.session.user }).lean();
      wishlistItems = wishlist ? wishlist.items : [];
    }

    res.render("product-details", {
      product,
      relatedProducts,
      user,
      cartCount, 
      wishlistItems
    });

  } catch (error) {
    next(error);
  }
};

// Load Review Page
const loadReviewPage = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    const user = req.session.user ? await User.findById(req.session.user) : null;

    if (!product) return res.status(404).send("Product Not Found");

    res.render("reviewPage", { product, user }); 
  } catch (error) {
    next(error);
  }
};

// Submit Review
const submitReview = async (req, res, next) => {
  try {
    const { rating, review } = req.body;
    const productId = req.params.id;

    //  Get logged-in user details
    const userData = await User.findById(req.session.user);

    await Product.findByIdAndUpdate(productId, {
      $push: {
        reviews: {
          user: userData._id,         // Save user ID
          name: userData.name,        // Save user name
          rating,
          review,
          date: new Date()
        }
      }
    });

    res.redirect("/product/" + productId);
  } catch (error) {
    next(error);
  }
};

export default {
  loadShoppage,
  loadProductDetails,
  loadReviewPage,
  submitReview
};