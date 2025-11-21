const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController");
const addressController = require("../controllers/user/addressController");
const cartController = require("../controllers/user/cartController");
const checkOutController = require("../controllers/user/checkOutController");
const orderController = require("../controllers/user/orderController");
const {userAuth,adminAuth} = require("../middlewares/auth");
const { uploads } = require("../helpers/multer");

//Error Management
router.get("/pageNotFound",userController.pageNotFound);
//Home and Shop page
router.get("/",userController.loadHomepage);
router.get("/shop",userController.loadShoppage);  //No login required ,remove userAuth
//Product-Detail Page
router.get("/product/:id",userController.loadProductDetails);  //No login required ,remove userAuth
//Profile Page
router.get('/account', userAuth, userController.loadAccountPage);
// Edit Profile
router.get("/edit-profile", userAuth, userController.loadEditProfile);
router.post("/edit-profile", userAuth, uploads.single("profileImage"), userController.updateProfile);
// Email change verification routes
// Email Change Flow
router.get("/change-email", userAuth, userController.loadEmailChangePage);
router.post("/verify-email-change", userAuth, userController.sendEmailChangeOtp);
router.post("/verify-email-change-otp", userAuth, userController.verifyEmailChangeOtp);
router.post("/resend-email-change-otp", userAuth, userController.resendEmailChangeOtp);



//review Page
router.get("/product/:id/review", userAuth, userController.loadReviewPage);
router.post("/product/:id/review", userAuth, userController.submitReview);
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


//checkout
router.get("/checkout", checkOutController.getCheckout);
router.get("/checkout/add-address", (req, res) => {
  res.render("checkout-add-address", {
    checkoutItems: req.session.checkoutItems || [],
    totals: req.session.checkoutTotals || {}
  });
});
router.post("/checkout/add-address", checkOutController.postAddAddress);
router.get("/checkout/edit-address/:id", checkOutController.getEditAddress);
router.post("/checkout/update-address/:id", checkOutController.postEditAddress);
router.post("/checkout/save-delivery", checkOutController.saveDeliveryDate);
router.get("/checkout/payment", checkOutController.getPaymentPage);
router.post("/checkout/place-order", checkOutController.placeOrder);
router.get("/checkout/success/:orderId", checkOutController.getSuccessPage);
router.get("/personalize", userAuth, checkOutController.getPersonalizePage);


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



module.exports = router;