const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const orderController = require("../controllers/admin/orderController");
const adminCouponController = require("../controllers/admin/adminCouponController");
const offerController = require("../controllers/admin/offerController");
const categoryOfferController = require("../controllers/admin/categoryOfferController");
const salesReportController = require("../controllers/admin/salesReportController");
const {userAuth,adminAuth} = require("../middlewares/auth")
const multer = require("multer");
const { uploads } = require("../helpers/multer");

router.get("/pageerror",adminController.pageerror);
//Login Management
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/",adminAuth,adminController.loadDashboard);
router.get("/dashboard",adminAuth, (req, res) => res.redirect("/admin/")); 
router.get("/logout",adminController.logout);
//User Management
router.get("/users",adminAuth,customerController.customerInfo);
router.patch("/customers/:id/block", adminAuth, customerController.customerBlocked);
router.patch("/customers/:id/unblock", adminAuth, customerController.customerUnBlocked);

//Category Management
router.get("/category",adminAuth,categoryController.categoryInfo);
router.get("/category/add", adminAuth, categoryController.loadAddCategoryPage);
router.post("/category/add",adminAuth,categoryController.addCategory);
router.patch("/categories/:id/list",adminAuth,categoryController.listCategory);
router.patch("/categories/:id/unlist",adminAuth,categoryController.unlistCategory);

router.get("/edit-category", adminAuth, categoryController.getEditCategory);
router.post("/edit-category/:id", adminAuth, categoryController.editCategory);
//Product Management
router.get('/products', adminAuth, productController.productinfo);
router.get('/products/add', adminAuth, productController.getProductAddPage);
router.post('/products/add',adminAuth,uploads.array('productImage', 6),productController.addProduct);
router.patch("/products/:id/block",adminAuth,productController.productBlocked);
router.patch("/products/:id/unblock",adminAuth,productController.productUnBlocked);
router.get("/edit-product", adminAuth, productController.getEditProduct);
router.post("/edit-product/:id", adminAuth, uploads.array("productImage", 4), productController.editProduct);

//order Management
router.get("/orders", adminAuth, orderController.loadOrderList);
router.get("/order-details/:id", adminAuth, orderController.loadOrderDetails);
router.post("/order/update-status/:id", adminAuth, orderController.updateOrderStatus);
router.post("/order/cancel/:id", adminAuth, orderController.cancelOrder);  
//order single item return management
router.get("/order/:orderId/item/:itemId/approve-return", adminAuth,orderController.approveReturnItem);
router.get("/order/:orderId/item/:itemId/reject-return", adminAuth,orderController.rejectReturnItem);
// return requests list page
router.get("/return-requests", adminAuth, orderController.loadReturnRequests);
//whole-order return amangement
router.get("/order/:id/reject-whole-return", adminAuth, orderController.rejectWholeReturn);
router.get("/order/:id/approve-whole-return", adminAuth, orderController.approveWholeReturn);
 
// coupon management
router.get("/coupons", adminAuth, adminCouponController.listCoupons);
router.get("/coupons/add", adminAuth, adminCouponController.loadAddCoupon);
router.post("/coupons/add", adminAuth, adminCouponController.createCoupon);
router.get("/coupons/edit/:id", adminAuth, adminCouponController.loadEditCoupon);
router.post("/coupons/edit/:id", adminAuth, adminCouponController.updateCoupon);
router.patch("/coupons/toggle/:id", adminAuth, adminCouponController.toggleCoupon);
router.delete("/coupons/:id", adminAuth, adminCouponController.deleteCoupon);

//offer management
router.get("/offer/add", adminAuth, offerController.loadAddOffer);
router.post("/offer/add", adminAuth, offerController.addOffer);
// Edit offer
router.get("/offer/edit/:id", adminAuth, offerController.loadEditOffer);
router.post("/offer/update", adminAuth, offerController.updateOffer);
// Delete offer
router.delete("/offer/delete/:id", adminAuth, offerController.deleteOffer);

//category offer
router.get("/category-offer/add", adminAuth, categoryOfferController.loadAddCategoryOffer);
router.post("/category-offer/add", adminAuth, categoryOfferController.addCategoryOffer);
router.get("/category-offer/edit/:id", adminAuth, categoryOfferController.loadEditCategoryOffer);
router.post("/category-offer/update", adminAuth, categoryOfferController.updateCategoryOffer);
router.delete("/category-offer/delete/:id", adminAuth, categoryOfferController.deleteCategoryOffer);

//salesreport
router.get("/sales-report",adminAuth,salesReportController.getSalesReport);
router.get("/sales-report/pdf",adminAuth,salesReportController.exportSalesReportPDF);
router.get("/sales-report/excel",adminAuth,salesReportController.exportSalesReportExcel);

module.exports = router;