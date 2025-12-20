const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { userAuth } = require("../middlewares/auth");

router.post("/create-razorpay-order", userAuth, paymentController.createRazorpayOrder);
router.post("/verify-payment", userAuth, paymentController.verifyPayment);
router.post("/mark-failed",userAuth, paymentController.markPaymentFailed);


module.exports = router;
