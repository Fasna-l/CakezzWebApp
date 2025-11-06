const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController");
const {userAuth,adminAuth} = require("../middlewares/auth")

//Error Management
router.get("/pageNotFound",userController.pageNotFound);

router.get("/",userController.loadHomepage);

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

router.get("/logout",userController.logout);

router.get("/shop",userAuth,userController.loadShoppage);

//Profile Management
router.get("/forgot-password",profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid)
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp);
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp)
router.post("/reset-password",profileController.postNewPassword);


module.exports = router;