const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const orderController = require("../controllers/admin/orderController");
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
// router.get("/blockCustomer",adminAuth,customerController.customerBlocked);
// router.get("/unblockCustomer",adminAuth,customerController.customerUnBlocked);
// router.patch("/block-customer", adminAuth, customerController.customerBlocked);
// router.patch("/unblock-customer", adminAuth, customerController.customerUnBlocked);
router.patch("/customers/:id/block", adminAuth, customerController.customerBlocked);
router.patch("/customers/:id/unblock", adminAuth, customerController.customerUnBlocked);

//Category Management
router.get("/category",adminAuth,categoryController.categoryInfo);
router.get("/category/add", adminAuth, categoryController.loadAddCategoryPage);
router.post("/category/add",adminAuth,categoryController.addCategory);
// router.get("/listCategory",adminAuth,categoryController.getListCategory);
// router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory);
// router.get("/editCategory",adminAuth,categoryController.getEditCategory);
// router.post("/editCategory/:id",adminAuth,categoryController.editCategory);
// router.get("/list-category", adminAuth, categoryController.getListCategory);
// router.get("/unlist-category", adminAuth, categoryController.getUnlistCategory);
router.patch(
  "/categories/:id/list",
  adminAuth,
  categoryController.listCategory
);

router.patch(
  "/categories/:id/unlist",
  adminAuth,
  categoryController.unlistCategory
);

router.get("/edit-category", adminAuth, categoryController.getEditCategory);
router.post("/edit-category/:id", adminAuth, categoryController.editCategory);
//Product Management
router.get('/products', adminAuth, productController.productinfo);
router.get('/products/add', adminAuth, productController.getProductAddPage);
router.post('/products/add',adminAuth,uploads.array('productImage', 6),productController.addProduct);
// router.get("/blockProduct",adminAuth,productController.productBlocked);
// router.get("/unblockProduct",adminAuth,productController.productUnBlocked);
// router.get("/editProduct",adminAuth,productController.getEditProduct);
// router.post("/editProduct/:id",adminAuth, uploads.array("productImage", 4),productController.editProduct);
// router.get("/block-product", adminAuth, productController.productBlocked);
// router.get("/unblock-product", adminAuth, productController.productUnBlocked);
router.patch(
  "/products/:id/block",
  adminAuth,
  productController.productBlocked
);

router.patch(
  "/products/:id/unblock",
  adminAuth,
  productController.productUnBlocked
);
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


module.exports = router;