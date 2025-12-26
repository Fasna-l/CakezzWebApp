const Wishlist = require("../models/wishlistSchema");

const wishlistCount = async (req, res, next) => {
  try {
    if (!req.session.user) {
      res.locals.wishlistCount = 0;
      return next();
    }

    const wishlist = await Wishlist.findOne({ user: req.session.user });
    res.locals.wishlistCount = wishlist ? wishlist.items.length : 0;
    next();
  } catch (error) {
    res.locals.wishlistCount = 0;
    next(error);
  }
};

module.exports = wishlistCount;
