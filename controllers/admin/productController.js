import Product from "../../models/productSchema.js";
import Category from "../../models/categorySchema.js";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../../utils/logger.js";

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* Get Product Listing Page */
const productinfo = async (req, res, next) => {
  try {
    let search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    const ProductData = await Product.find({
      productName: { $regex: search, $options: "i" }
    })
      .populate('category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalProducts = await Product.countDocuments({
      productName: { $regex: search, $options: "i" }
    });

    res.render("products", {
      products: ProductData,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      search
    });
  } catch (error) {
      next(error);
  }
};

/*  Get Add Product Page */
const getProductAddPage = async (req, res, next) => {
  try {
    const category = await Category.find({ isListed: true });
    res.render("addProducts", { cat: category });
  } catch (error) {
    next(error);
  }
};

/*  Add New Product */
const addProduct = async (req, res, next) => {
  try {
    const { productName, description, category, variants } = req.body;
    console.log(req.body);

    //  Validation Step
    if (!productName || !description || !category) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // Prevent Duplicate Product Name
    const productExists = await Product.findOne({
      productName: { $regex: new RegExp("^" + productName + "$", "i") }
    });
    if (productExists) {
      return res.status(400).json({
        success: false,
        message: "Product already exists. Choose another name."
      });
    }

    // Validate Category
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid category selected."
      });
    }

    //  Validate Images
    console.log("✅ Received Files from Frontend:", req.files?.length);
    if (!req.files || req.files.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Upload at least 3 product images."
      });
    }

    //  Process Images using Sharp
    let imageFilenames = [];
    for (let i = 0; i < req.files.length; i++) {
      const filename = `${Date.now()}-${i}.jpg`;
      const outputPath = path.join(
        __dirname,
        "../../public/uploads/product/",
        filename
      );

      await sharp(req.files[i].buffer)
        .resize(800, 800, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toFile(outputPath);

      imageFilenames.push(filename);
    }

    //  Format Variants (1kg, 2kg, 3kg)
    const formattedVariants = variants
      ? Object.values(variants).map((v, idx) => ({
          size: ["1kg", "2kg", "3kg"][idx],
          stock: Number(v.stock) || 0,
          price: Number(v.price) || 0
        }))
      : [];

        const totalStock = formattedVariants.reduce((sum, v) => sum + (v.stock || 0), 0);

    //  Save Product to MongoDB
    const newProduct = new Product({
      productName,
      description,
      category,
      variants: formattedVariants,
      productImage: imageFilenames,
      status: totalStock > 0 ? "Available" : "Out_of_stock"
    });

    await newProduct.save();
    logger.info(
      `ADMIN PRODUCT CREATED | ProductId: ${newProduct._id} | Name: ${productName} | Status: ${newProduct.status}`
    );
    return res.status(200).json({ success: true });

  } catch (error) {
      next(error);
  }
};

const productBlocked = async (req,res,next)=>{
    try {
        let id = req.params.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:true}});
        logger.warn(
          `ADMIN PRODUCT BLOCKED | ProductId: ${id}`
        );
        return res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
}  

const productUnBlocked = async (req,res,next)=>{
    try {
        const id = req.params.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:false}});
        logger.info(
          `ADMIN PRODUCT UNBLOCKED | ProductId: ${id}`
        );
        return res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
}

const getEditProduct = async (req,res, next)=>{
    try {
        const id = req.query.id;
        const page = req.query.page || 1;
        const product = await Product.findOne({_id:id});
        const category = await Category.find({});
        res.render("editProduct",{
            product:product,
            cat:category,
            page
        })
    } catch (error) {
      next(error);  
    }
}

const editProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const page = req.body.page || 1;
    const { productName, description, category, variants, removedImages } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.json({ success: false, message: "Product not found" });
    }

    // Remove deleted images
    if (removedImages) {
      JSON.parse(removedImages).forEach((imgPath) => {
        const fullPath = path.join(__dirname, "../../public", imgPath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        const imageName = imgPath.split("/uploads/product/")[1]; // get only filename
        product.productImage = product.productImage.filter(img => img !== imageName);

    });
    }

    // Add new uploaded or cropped images
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        const filename = `${Date.now()}-${file.originalname}`;
        const savePath = path.join(__dirname, "../../public/uploads/product/", filename);

        await sharp(file.buffer)
          .resize(800, 800, { fit: "cover" })
          .jpeg({ quality: 80 })
          .toFile(savePath);
        product.productImage.push(filename);
      }
    }

    //  Update other fields
    product.productName = productName;
    product.description = description;
    product.category = category;
    product.variants = variants
        ? Object.values(variants).map((v, idx) => ({
            size: ["1kg", "2kg", "3kg"][idx],
            stock: Number(v.stock) || 0,
            price: Number(v.price) || 0
        }))
    : product.variants;

    const updatedStock = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    product.status = updatedStock > 0 ? "Available" : "Out_of_stock";

    await product.save();
    logger.info(
      `ADMIN PRODUCT UPDATED | ProductId: ${productId} | Name: ${product.productName} | Status: ${product.status}`
    );
    res.json({ success: true, message: "Product updated successfully!" ,redirectUrl: `/admin/products?page=${page}` });

  } catch (error) {
    next(error);
  }
};

export default {
  productinfo,
  getProductAddPage,
  addProduct,
  productBlocked,
  productUnBlocked,
  getEditProduct,
  editProduct
};
