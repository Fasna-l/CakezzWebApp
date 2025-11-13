const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController");
const addressController = require("../controllers/user/addressController");
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

module.exports = router;