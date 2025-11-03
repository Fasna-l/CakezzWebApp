const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const {adminAuth} = require("../middlewares/auth")

router.get("/pageerror",adminController.pageerror);
//Login Management
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/",adminAuth,adminController.loadDashboard);
router.get("/dashboard",adminAuth, (req, res) => res.redirect("/admin/"));
//router.get("/dashboard", adminAuth, adminController.loadDashboard); //add to manage the path realaod 
router.get("/logout",adminController.logout);
//User Management
router.get("/users",adminAuth,customerController.customerInfo);
router.get("/blockCustomer",adminAuth,customerController.customerBlocked);
router.get("/unblockCustomer",adminAuth,customerController.customerUnBlocked);
//Category Management
router.get("/category",adminAuth,categoryController.categoryInfo);
router.get("/category/add", adminAuth, categoryController.loadAddCategoryPage);
router.post("/category/add",adminAuth,categoryController.addCategory);
router.get("/listCategory",adminAuth,categoryController.getListCategory);
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory);
router.get("/editCategory",adminAuth,categoryController.getEditCategory);
router.post("/editCategory/:id",adminAuth,categoryController.editCategory);


module.exports = router;