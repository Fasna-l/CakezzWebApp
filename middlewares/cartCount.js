const Cart = require("../models/cartSchema");

const cartCount = async (req, res, next) => {
  try {
    if (!req.session.user) {
      res.locals.cartCount = 0;
      return next();
    }

    const cart = await Cart.findOne({ user: req.session.user });
    res.locals.cartCount = cart ? cart.items.length : 0;
    next();
  } catch (error) {
    console.log("cartCount middleware error:", error);
    res.locals.cartCount = 0;
    next();
  }
};

module.exports = cartCount;
