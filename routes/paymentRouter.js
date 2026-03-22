import express from "express";
import paymentController from "../controllers/paymentController.js";
import { userAuth } from "../middlewares/auth.js";

const router = express.Router();

router.post("/create-razorpay-order", userAuth, paymentController.createRazorpayOrder);
router.post("/verify-payment", userAuth, paymentController.verifyPayment);
router.post("/mark-failed", userAuth, paymentController.markPaymentFailed);

// Retry payment
router.get("/retry/:orderId", userAuth, paymentController.retryPayment);

export default router;