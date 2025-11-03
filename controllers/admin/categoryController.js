const Category = require("../../models/categorySchema");


const categoryInfo = async (req,res)=>{
    try {

        //search button
        let search="";
        if(req.query.search){
            search=req.query.search;
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 3;
        const skip = (page-1)*limit;

        const categoryData = await Category.find({
            categoryName: { $regex: search, $options: "i" }
        })
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit);

        const totalCategories = await Category.countDocuments({
            categoryName: { $regex: search, $options: "i" }
        });
        const totalPages = Math.ceil(totalCategories / limit);
        res.render("category",{
            cat:categoryData,
            currentPage:page,
            totalPages:totalPages,
            totalCategories:totalCategories,
            search
        });
    } catch (error) {
        console.error(error);
        res.redirect("/pageerror")
    }
}

//Load Category Page
const loadAddCategoryPage = async (req, res) => {
    try {
        res.render("addCategory"); 
    } catch (error) {
        console.error("Error loading Add Category page:", error);
        res.status(500).send("Server Error");
    }
};


const addCategory = async (req,res)=>{
    const {categoryName,description} = req.body
    try {
        const existingCategory = await Category.findOne({categoryName});
        if(existingCategory){
            return res.status(400).json({error:"Category already exists"})
        }
        const newCategory = new Category({
            categoryName,
            description,
        })
        await newCategory.save();
        return res.json({message:"Category added successfully"})
    } catch (error) {
        return res.status(500).json({error:"Internal Server Error"})
    }
}

//list/unlist in category 

const getListCategory = async (req,res)=>{
    try {
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:false}});
        res.json({ success: true, message: "Category unlisted", isListed: false, id });
    } catch (error) {
        console.error("Error unlisting category:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
}

const getUnlistCategory = async (req,res)=>{
    try {
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:true}});
        res.json({ success: true, message: "Category listed", isListed: true, id });
    } catch (error) {
        console.error("Error listing category:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
}

const getEditCategory = async (req,res)=>{
    try {
        const id = req.query.id;
        const category = await Category.findOne({_id:id});
        res.render("editCategory",{category:category});
    } catch (error) {
        res.redirect("/pageerror")
    }
}

const editCategory = async (req,res)=>{
    try {
        const id = req.params.id;
        const {categoryName,description} =req.body;
        
        //Check if another category with same name exists
        const existingCategory = await Category.findOne({categoryName:categoryName,_id:{$ne:id}});   //// Exclude current category
        if(existingCategory){
            return res.status(400).json({success:false,error:"Category name already exists,Please choose another name"});
        }

        //Update the category
        const updateCategory = await Category.findByIdAndUpdate(id,{
            categoryName:categoryName,
            description:description,
        },{ new: true })

        if(updateCategory){
            return res.status(200).json({
            success: true,
            message: "Category updated successfully!"
        });
            //res.redirect("/admin/category")
        }else {
            res.status(404).json({success:false,error:"Category not found"})
        }

    } catch (error) {
        res.status(500).json({success:false,error:"Internal server error"})
    }
}

module.exports = {
    categoryInfo,
    loadAddCategoryPage,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory
}