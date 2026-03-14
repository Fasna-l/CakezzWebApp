import express from "express";
import passport from "passport";

import userController from "../controllers/user/userController.js";
import profileController from "../controllers/user/profileController.js";
import addressController from "../controllers/user/addressController.js";
import productController from "../controllers/user/productController.js";
import cartController from "../controllers/user/cartController.js";
import checkOutController from "../controllers/user/checkOutController.js";
import orderController from "../controllers/user/orderController.js";
import walletController from "../controllers/user/walletController.js";
import wishlistController from "../controllers/user/wishlistController.js";
import couponController from "../controllers/user/couponController.js";
import referralController from "../controllers/user/referralController.js";

import { userAuth, adminAuth } from "../middlewares/auth.js";
import { uploads } from "../helpers/multer.js";
import Cart from "../models/cartSchema.js";

const router = express.Router();

// Error
router.get("/pageNotFound", userController.pageNotFound);

// Home & Shop
router.get("/", userController.loadHomepage);
router.get("/shop", productController.loadShoppage);
router.get("/product/:id", productController.loadProductDetails);

// Review
router.get("/product/:id/review", userAuth, productController.loadReviewPage);
router.post("/product/:id/review", userAuth, productController.submitReview);

// Profile
router.get("/account", userAuth, profileController.loadAccountPage);
router.get("/edit-profile", userAuth, profileController.loadEditProfile);
router.patch("/edit-profile", userAuth, uploads.single("profileImage"), profileController.updateProfile);

// Email Change
router.get("/change-email", userAuth, profileController.loadEmailChangePage);
router.post("/verify-email-change", userAuth, profileController.sendEmailChangeOtp);
router.patch("/verify-email-change-otp", userAuth, profileController.verifyEmailChangeOtp);
router.post("/resend-email-change-otp", userAuth, profileController.resendEmailChangeOtp);

// Signup
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);

// Google Auth
router.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  userController.googleAuth
);

// Login
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.post("/logout", userController.logout);

// Forgot Password
router.get("/forgot-password", profileController.getForgotPassPage);
router.post("/forgot-email-valid", profileController.forgotEmailValid);
router.post("/verify-passForgot-otp", profileController.verifyForgotPassOtp);
router.get("/reset-password", profileController.getResetPassPage);
router.post("/resend-forgot-otp", profileController.resendOtp);
router.post("/reset-password", profileController.postNewPassword);

// Change Password
router.get("/password", userAuth, profileController.getChangePasswordPage);
router.patch("/password", userAuth, profileController.postChangePassword);

// Address
router.get("/address", userAuth, addressController.loadAddressPage);
router.post("/address", userAuth, addressController.addAddress);
router.get("/address/:id/edit", userAuth, addressController.loadEditAddress);
router.patch("/address/:id", userAuth, addressController.updateAddress);
router.delete("/address/:id", userAuth, addressController.deleteAddress);
router.patch("/address/:id/default", userAuth, addressController.setDefaultAddress);

// Cart
router.get("/cart", userAuth, cartController.getCartPage);
router.post("/cart", userAuth, cartController.addToCart);
router.patch("/cart", userAuth, cartController.updateQuantity);
router.delete("/cart", userAuth, cartController.removeCartItem);

// Cart count (fixed require issue)
router.get("/cart-count", userAuth, async (req, res) => {
  const count = (await Cart.findOne({ user: req.session.user }))?.items.length || 0;
  res.json({ count });
});

router.get("/cart/checkout", userAuth, cartController.proceedToCheckout);

// Wishlist
router.get("/wishlist", userAuth, wishlistController.loadWishlist);
router.post("/wishlist", wishlistController.toggleWishlist);
router.delete("/wishlist", wishlistController.removeFromWishlist);
router.get("/wishlist/count", wishlistController.wishlistCount);

// Checkout
router.get("/checkout", userAuth, checkOutController.getCheckout);
// Address inside checkout
router.get("/checkout/address/new", userAuth, (req, res) => {
  res.render("checkout-add-address", {
    checkoutItems: req.session.checkoutItems || [],
    totals: req.session.checkoutTotals || {}
  });
});

router.post("/checkout/address", userAuth, checkOutController.postAddAddress);
router.get("/checkout/address/:id/edit", userAuth, checkOutController.getEditAddress);
router.patch("/checkout/address/:id", userAuth, checkOutController.postEditAddress);
router.post("/checkout/delivery", userAuth, checkOutController.saveDeliveryDate);
router.get("/checkout/payment", userAuth, checkOutController.getPaymentPage);
router.post("/orders", userAuth, checkOutController.placeOrder);
router.get("/orders/:orderId/success", userAuth, checkOutController.getSuccessPage);
router.get("/checkout/personalize", userAuth, checkOutController.getPersonalizePage);
router.get("/orders/:orderId/failure", userAuth, checkOutController.loadPaymentFailurePage);

// Orders
router.get("/order", userAuth, orderController.loadOrderList);
router.get("/order/cancel/:id", userAuth, orderController.loadCancelPage);
router.patch("/order/cancel/:id", userAuth, orderController.cancelOrder);
router.get("/order/return/:id", userAuth, orderController.loadReturnPage);
router.post("/order/return/:id", userAuth, orderController.submitReturnRequest);
router.get("/order/invoice/:id", userAuth, orderController.downloadInvoice);
router.get("/order/:orderId/item/:itemId/return", userAuth, orderController.loadSingleReturnPage);
router.post("/order/:orderId/item/:itemId/return", userAuth, orderController.submitSingleReturn);
router.get("/order/:id", userAuth, orderController.loadOrderDetails);

// Wallet
router.get("/wallet", userAuth, walletController.loadWallet);
router.get("/wallet/history", userAuth, walletController.loadWalletHistory);
router.post("/wallet/recharge", userAuth, walletController.createWalletRechargeOrder);
router.post("/wallet/recharge/verify", userAuth, walletController.verifyWalletRecharge);

// Coupons
router.get("/coupon/available", userAuth, couponController.getAvailableCoupons);
router.post("/coupon/apply", userAuth, couponController.applyCoupon);
router.delete("/coupon", userAuth, couponController.removeCoupon);

// Referral
router.get("/referral", userAuth, referralController.loadReferralPage);

// Contact
router.get("/contact", userController.loadContact);

// About
router.get("/about", userController.loadAbout);

export default router;