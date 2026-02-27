const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");
const calculateBestOffer = require("../../helpers/offerCalculator");

const loadWishlist = async (req, res, next) => {
  try {
    const userId = req.session.user;

    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const wishlist = await Wishlist.findOne({ user: userId })
      .populate({
        path: "items.product",
        populate: { path: "category" }
      });

    if (!wishlist || wishlist.items.length === 0) {
      return res.render("wishlist", {
        wishlist: { items: [] },
        totalWishlistItems: 0,
        wishlistCurrentPage: 1,
        wishlistTotalPages: 1
      });
    }

    const validItems = wishlist.items.filter(
      i => i.product && !i.product.isBlocked
    );

    const totalItems = validItems.length;
    const paginatedItems = validItems.slice(skip, skip + limit);

    const wishlistItemsWithOffer = await Promise.all(
      paginatedItems.map(async (item) => {
        const product = item.product;
        const variant = product.variants[0]; // 1kg display

        const offer = await calculateBestOffer(product, variant.price);

        return {
          ...item.toObject(),
          product: {
            ...product.toObject(),
            finalPrice: offer.finalPrice,
            originalPrice: variant.price,
            offerPercentage: offer.discountPercentage,
            appliedOfferType: offer.appliedOfferType
          }
        };
      })
    );

    res.render("wishlist", {
      wishlist: { items: wishlistItemsWithOffer },
      totalWishlistItems: totalItems,
      wishlistCurrentPage: page,
      wishlistTotalPages: Math.ceil(totalItems / limit)
    });

  } catch (error) {
    next(error);
  }
};

//ADD / REMOVE WISHLIST
const toggleWishlist = async (req, res, next) => {
  try {
    if (!req.session.user) {
      return res.json({ success: false, message: "Please login to continue" });
    }

    const { productId, size } = req.body;
    const userId = req.session.user;

    const product = await Product.findById(productId);
    if (!product || product.isBlocked) {
      return res.json({ success: false, message: "Product unavailable" });
    }

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) wishlist = new Wishlist({ user: userId, items: [] });

    const exists = wishlist.items.find(
      i => i.product.toString() === productId && i.size === size
    );

    if (exists) {
      wishlist.items = wishlist.items.filter(
        i => !(i.product.toString() === productId && i.size === size)
      );

      await wishlist.save();

      //const count = wishlist.items.length;
      
      return res.json({
        success: true,
        message: "Removed from wishlist",
        isAdded: false,
        //wishlistCount: count
      });
    } else {
      wishlist.items.push({ product: productId, size });
      
      await wishlist.save();
      
      //const count = wishlist.items.length;
      
      return res.json({
        success: true,
        message: "Added to wishlist",
        isAdded: true,
        //wishlistCount: count
      });
    }
  } catch (error) {
    next(error)
  }
};

//REMOVE FROM WISHLIST (PAGE)
const removeFromWishlist = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const { productId,size } = req.body;

    await Wishlist.updateOne(
      { user: userId },
      { $pull: { items: { product: productId, size } } }
    );

    res.json({ success: true });
  } catch(error) {
    next(error)
  }
};

//WISHLIST COUNT (LIKE CART)
const wishlistCount = async (req, res, next) => {
  try {
    if (!req.session.user) {
      return res.json({ count: 0 });
    }

    const wishlist = await Wishlist.findOne({ user: req.session.user });
    res.json({ count: wishlist ? wishlist.items.length : 0 });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  loadWishlist,
  toggleWishlist,
  removeFromWishlist,
  wishlistCount
};
