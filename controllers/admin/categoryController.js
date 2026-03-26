import Category from "../../models/categorySchema.js";
import logger from "../../utils/logger.js";
import HTTP_STATUS from "../../utils/httpStatus.js";
import RESPONSE_MESSAGES from "../../utils/responseMessages.js";

const categoryInfo = async (req, res, next) => {
    try {
        let search = "";
        if (req.query.search) {
            search = req.query.search;
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 3;
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({
            categoryName: { $regex: search, $options: "i" }
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments({
            categoryName: { $regex: search, $options: "i" }
        });
        const totalPages = Math.ceil(totalCategories / limit);
        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            search
        });
    } catch (error) {
        next(error);
    }
}

const loadAddCategoryPage = async (req, res, next) => {
    try {
        res.render("addCategory");
    } catch (error) {
        next(error);
    }
};


const addCategory = async (req, res, next) => {
    const { categoryName, description } = req.body
    try {
        const existingCategory = await Category.findOne({ categoryName });
        if (existingCategory) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                message: RESPONSE_MESSAGES.CATEGORY_ALREADY_EXISTS
            });
        }
        const newCategory = new Category({
            categoryName,
            description,
        })
        await newCategory.save();
        logger.info(
            `ADMIN CATEGORY CREATED | CategoryId: ${newCategory._id} | Name: ${categoryName}`
        );
        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: RESPONSE_MESSAGES.CATEGORY_ADDED
        });
    } catch (error) {
        next(error);
    }
}

const listCategory = async (req, res, next) => {
    try {
        const { id } = req.params;

        await Category.updateOne(
            { _id: id },
            { $set: { isListed: true } }
        );

        logger.info(
            `ADMIN CATEGORY LISTED | CategoryId: ${id}`
        );
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: RESPONSE_MESSAGES.CATEGORY_LISTED
        });
    } catch (error) {
        next(error);
    }
};

const unlistCategory = async (req, res, next) => {
    try {
        const { id } = req.params;

        await Category.updateOne(
            { _id: id },
            { $set: { isListed: false } }
        );

        logger.warn(
            `ADMIN CATEGORY UNLISTED | CategoryId: ${id}`
        );
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: RESPONSE_MESSAGES.CATEGORY_UNLISTED
        });
    } catch (error) {
        next(error);
    }
};

const getEditCategory = async (req, res, next) => {
    try {
        const id = req.query.id;
        const category = await Category.findOne({ _id: id });
        res.render("editCategory", { category: category });
    } catch (error) {
        next(error);
    }
}

const editCategory = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;

        //Check if another category with same name exists
        const existingCategory = await Category.findOne({ categoryName: categoryName, _id: { $ne: id } });   //// Exclude current category
        if (existingCategory) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: RESPONSE_MESSAGES.CATEGORY_ALREADY_EXISTS
            });
        }

        //Update the category
        const updateCategory = await Category.findByIdAndUpdate(id, {
            categoryName: categoryName,
            description: description,
        }, { new: true })

        if (updateCategory) {
            logger.info(
                `ADMIN CATEGORY UPDATED | CategoryId: ${id} | Name: ${updateCategory.categoryName}`
            );
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                message: RESPONSE_MESSAGES.CATEGORY_UPDATED
            });
        } else {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: RESPONSE_MESSAGES.CATEGORY_NOT_FOUND
            });
        }

    } catch (error) {
        next(error);
    }
}

export default {
    categoryInfo,
    loadAddCategoryPage,
    addCategory,
    listCategory,
    unlistCategory,
    getEditCategory,
    editCategory,
};