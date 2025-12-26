const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController");
const addressController = require("../controllers/user/addressController");
const productController = require("../controllers/user/productController");
const cartController = require("../controllers/user/cartController");
const checkOutController = require("../controllers/user/checkOutController");
const orderController = require("../controllers/user/orderController");
const walletController = require("../controllers/user/walletController");
const wishlistController = require("../controllers/user/wishlistController");
const {userAuth,adminAuth} = require("../middlewares/auth");
const { uploads } = require("../helpers/multer");


//Error Management
router.get("/pageNotFound",userController.pageNotFound);
//Home and Shop page
router.get("/",userController.loadHomepage);
router.get("/shop",productController.loadShoppage);  //No login required ,remove userAuth
//Product-Detail Page
router.get("/product/:id",productController.loadProductDetails);  //No login required ,remove userAuth

//review Page
router.get("/product/:id/review", userAuth, productController.loadReviewPage);
router.post("/product/:id/review", userAuth, productController.submitReview);
//Profile Page
router.get('/account', userAuth, profileController.loadAccountPage);
// Edit Profile
router.get("/edit-profile", userAuth, profileController.loadEditProfile);
router.post("/edit-profile", userAuth, uploads.single("profileImage"), profileController.updateProfile);
// Email change verification routes
// Email Change Flow
router.get("/change-email", userAuth, profileController.loadEmailChangePage);
router.post("/verify-email-change", userAuth, profileController.sendEmailChangeOtp);
router.post("/verify-email-change-otp", userAuth, profileController.verifyEmailChangeOtp);
router.post("/resend-email-change-otp", userAuth, profileController.resendEmailChangeOtp);

//Signup management
router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup);
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)
router.get("/auth/google",
    passport.authenticate("google",{scope:["profile","email"]}));
// router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/signup"}),(req,res)=>{
//     res.redirect("/")
// })
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  userController.googleAuth
);
//Login Management
router.get("/login",userController.loadLogin);
router.post("/login",userController.login);
//logout
router.get("/logout",userController.logout);
//Profile Management(forget and reset password)
router.get("/forgot-password",profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid)
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp);
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp)
router.post("/reset-password",profileController.postNewPassword);


// Change Password
router.get("/password", userAuth, profileController.getChangePasswordPage);
router.post("/password", userAuth, profileController.postChangePassword);

//Address management
router.get("/address", userAuth, addressController.loadAddressPage);
router.post("/add-address", userAuth, addressController.addAddress);
router.get("/edit-address/:id", userAuth, addressController.loadEditAddress);
router.post("/update-address/:id", userAuth, addressController.updateAddress);
router.delete("/delete-address/:id", userAuth, addressController.deleteAddress);
router.post("/set-default-address/:id", userAuth, addressController.setDefaultAddress);

// cart management
router.post("/add-to-cart", userAuth, cartController.addToCart);
router.post("/cart/update-qty", userAuth, cartController.updateQuantity);
router.post("/cart/remove", userAuth, cartController.removeCartItem);
router.get("/cart", userAuth, cartController.getCartPage);
// cart count
router.get("/cart-count", userAuth, async (req, res) => {
  const Cart = require("../models/cartSchema");
  const count = (await Cart.findOne({ user: req.session.user }))?.items.length || 0;
  res.json({ count });
});
router.get("/cart/checkout", userAuth, cartController.proceedToCheckout);

//wishlist management
// wishlist page
router.get("/wishlist", userAuth, wishlistController.loadWishlist);

// add / remove wishlist
router.post("/wishlist/toggle", userAuth, wishlistController.toggleWishlist);
router.post("/wishlist/remove", userAuth, wishlistController.removeFromWishlist);
router.get("/wishlist-count", userAuth, wishlistController.wishlistCount);


//checkout
router.get("/checkout",userAuth, checkOutController.getCheckout);
router.get("/checkout/add-address",userAuth, (req, res) => {
  res.render("checkout-add-address", {
    checkoutItems: req.session.checkoutItems || [],
    totals: req.session.checkoutTotals || {}
  });
});
router.post("/checkout/add-address",userAuth, checkOutController.postAddAddress);
router.get("/checkout/edit-address/:id",userAuth, checkOutController.getEditAddress);
router.post("/checkout/update-address/:id",userAuth, checkOutController.postEditAddress);
router.post("/checkout/save-delivery",userAuth, checkOutController.saveDeliveryDate);
router.get("/checkout/payment",userAuth, checkOutController.getPaymentPage);
router.post("/checkout/place-order",userAuth, checkOutController.placeOrder);
router.get("/checkout/success/:orderId",userAuth, checkOutController.getSuccessPage);
router.get("/personalize", userAuth, checkOutController.getPersonalizePage);
// payment failure page
router.get("/order-failure/:orderId", userAuth, checkOutController.loadPaymentFailurePage);

//order management
router.get("/order", userAuth, orderController.loadOrderList);
router.get("/order/:id", userAuth, orderController.loadOrderDetails);
// Cancel Whole order + single product
router.get("/order/cancel/:id", userAuth, orderController.loadCancelPage);
router.post("/order/cancel/:id", userAuth, orderController.cancelOrder);
// Return order
router.get("/order/return/:id", userAuth, orderController.loadReturnPage);
router.post("/order/return/:id", userAuth, orderController.submitReturnRequest);
router.get("/order/invoice/:id", userAuth, orderController.downloadInvoice);
//return single item
router.get("/order/:orderId/item/:itemId/return", userAuth,orderController.loadSingleReturnPage);
router.post("/order/:orderId/item/:itemId/return", userAuth,orderController.submitSingleReturn);

// Wallet management
router.get("/wallet", userAuth, walletController.loadWallet);
router.get("/wallet/history", userAuth, walletController.loadWalletHistory);
// Wallet recharge (Razorpay)
router.post("/wallet/recharge", userAuth, walletController.createWalletRechargeOrder);
router.post("/wallet/recharge/verify", userAuth, walletController.verifyWalletRecharge);





module.exports = router;