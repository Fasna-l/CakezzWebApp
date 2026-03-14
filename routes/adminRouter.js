import express from "express";

import adminController from "../controllers/admin/adminController.js";
import customerController from "../controllers/admin/customerController.js";
import categoryController from "../controllers/admin/categoryController.js";
import productController from "../controllers/admin/productController.js";
import orderController from "../controllers/admin/orderController.js";
import adminCouponController from "../controllers/admin/adminCouponController.js";
import offerController from "../controllers/admin/offerController.js";
import categoryOfferController from "../controllers/admin/categoryOfferController.js";
import salesReportController from "../controllers/admin/salesReportController.js";
import referralController from "../controllers/admin/referralController.js";
import bannerController from "../controllers/admin/bannerController.js";

import { userAuth, adminAuth} from "../middlewares/auth.js";
import multer from "multer";
import { uploads } from "../helpers/multer.js";

const router = express.Router();

router.get("/pageerror", adminController.pageerror);

// Login Management
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/", adminAuth, adminController.loadDashboard);
router.get("/dashboard", adminAuth, (req, res) => res.redirect("/admin/"));
router.get("/sales-chart", adminAuth, adminController.getSalesChart);
router.get("/logout", adminController.logout);

// User Management
router.get("/users", adminAuth, customerController.customerInfo);
router.patch("/customers/:id/block", adminAuth, customerController.customerBlocked);
router.patch("/customers/:id/unblock", adminAuth, customerController.customerUnBlocked);

// Category Management
router.get("/category", adminAuth, categoryController.categoryInfo);
router.get("/category/add", adminAuth, categoryController.loadAddCategoryPage);
router.post("/category/add", adminAuth, categoryController.addCategory);
router.patch("/categories/:id/list", adminAuth, categoryController.listCategory);
router.patch("/categories/:id/unlist", adminAuth, categoryController.unlistCategory);

router.get("/edit-category", adminAuth, categoryController.getEditCategory);
router.patch("/categories/:id", adminAuth, categoryController.editCategory);

// Product Management
router.get("/products", adminAuth, productController.productinfo);
router.get("/products/add", adminAuth, productController.getProductAddPage);
router.post("/products/add", adminAuth, uploads.array("productImage", 6), productController.addProduct);
router.patch("/products/:id/block", adminAuth, productController.productBlocked);
router.patch("/products/:id/unblock", adminAuth, productController.productUnBlocked);
router.get("/edit-product", adminAuth, productController.getEditProduct);
router.patch("/products/:id", adminAuth, uploads.array("productImage", 4), productController.editProduct);

// Order Management
router.get("/orders", adminAuth, orderController.loadOrderList);
router.get("/order-details/:id", adminAuth, orderController.loadOrderDetails);
router.patch("/orders/:id/status", adminAuth, orderController.updateOrderStatus);
router.patch("/orders/:id/cancel", adminAuth, orderController.cancelOrder);
router.patch("/orders/:orderId/items/:itemId/approve-return", adminAuth, orderController.approveReturnItem);
router.patch("/orders/:orderId/items/:itemId/reject-return", adminAuth, orderController.rejectReturnItem);
router.get("/return-requests", adminAuth, orderController.loadReturnRequests);
router.patch("/orders/:id/reject-return", adminAuth, orderController.rejectWholeReturn);
router.patch("/orders/:id/approve-return", adminAuth, orderController.approveWholeReturn);

// Coupon Management
router.get("/coupons", adminAuth, adminCouponController.listCoupons);
router.get("/coupons/add", adminAuth, adminCouponController.loadAddCoupon);
router.post("/coupons/add", adminAuth, adminCouponController.createCoupon);
router.get("/coupons/edit/:id", adminAuth, adminCouponController.loadEditCoupon);
router.patch("/coupons/:id", adminAuth, adminCouponController.updateCoupon);
router.patch("/coupons/toggle/:id", adminAuth, adminCouponController.toggleCoupon);
router.delete("/coupons/:id", adminAuth, adminCouponController.deleteCoupon);

// Offer Management
router.get("/offer/add", adminAuth, offerController.loadAddOffer);
router.post("/offer/add", adminAuth, offerController.addOffer);
router.get("/offer/edit/:id", adminAuth, offerController.loadEditOffer);
router.patch("/offers/:id", adminAuth, offerController.updateOffer);
router.delete("/offer/delete/:id", adminAuth, offerController.deleteOffer);

// Category Offer
router.get("/category-offer/add", adminAuth, categoryOfferController.loadAddCategoryOffer);
router.post("/category-offer/add", adminAuth, categoryOfferController.addCategoryOffer);
router.get("/category-offer/edit/:id", adminAuth, categoryOfferController.loadEditCategoryOffer);
router.patch("/category-offers/:id", adminAuth, categoryOfferController.updateCategoryOffer);
router.delete("/category-offer/delete/:id", adminAuth, categoryOfferController.deleteCategoryOffer);

// Sales Report
router.get("/sales-report", adminAuth, salesReportController.getSalesReport);
router.get("/sales-report/pdf", adminAuth, salesReportController.exportSalesReportPDF);
router.get("/sales-report/excel", adminAuth, salesReportController.exportSalesReportExcel);

//referralpage
router.get("/referrals", adminAuth, referralController.loadReferralPage);
router.patch("/referral-settings", adminAuth, referralController.updateReferralSettings);

// Banner Image(slider) Management
router.get("/banners", adminAuth, bannerController.loadBannerPage);
router.post("/banners",adminAuth,uploads.single("bannerImage"),bannerController.addBanner);
router.delete("/banners/:id",adminAuth,bannerController.deleteBanner);

export default router;