import User from "../../models/userSchema.js";
import Order from "../../models/orderSchema.js";
import Product from "../../models/productSchema.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { authLogger } from "../../utils/logger.js";

const pageerror = async (req,res)=>{
    res.render("admin-error")
}

const loadLogin = (req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard");
    }
    res.render("admin-login",{message:null})
}

const login = async (req,res,next)=>{
    try {
        const {email,password} = req.body;
        const admin = await User.findOne({email: email,isAdmin:true});
        if(admin){
            const passwordMatch = await bcrypt.compare(password,admin.password);
            if(passwordMatch){
                req.session.admin = admin._id;
                
                authLogger.info(
                    `ADMIN LOGIN SUCCESS | AdminId: ${admin._id} | Email: ${admin.email} | IP: ${req.ip}`
                );
                
                return res.redirect("/admin")
            }else{
                authLogger.warn(
                    `ADMIN LOGIN FAILED | Email: ${email} | Reason: Invalid Password | IP: ${req.ip}`
                );
                res.render("admin-login", { message: "Invalid email or password" });
            }
        }else{
            authLogger.warn(
                `ADMIN LOGIN FAILED | Email: ${email} | Reason: Admin Not Found | IP: ${req.ip}`
            );

            res.render("admin-login", { message: "Invalid email or password" });
        }
    } catch (error) {
        next(error);
    }
}

const loadDashboard = async (req,res,next)=>{
    if(!req.session.admin){
        return res.redirect("/admin/login")
    }
    try {
        authLogger.info(
          `ADMIN DASHBOARD ACCESS | AdminId: ${req.session.admin} | IP: ${req.ip}`
        );
        //Dashboard statistics
        const totalUsers = await User.countDocuments({isAdmin:false});
        const totalOrders = await Order.countDocuments();
        const revenueData = await Order.aggregate([
            {
                $group:{_id:null,totalRevenue:{$sum:"$totalAmount"}}
            }
        ]);

        const totalRevenue = revenueData[0]?.totalRevenue || 0;

        //Best selling product (top 10)
        const bestProducts = await Order.aggregate([
            {$unwind :"$items"},
            {
                $group:{_id:"$items.productId", totalSold:{$sum:"$items.quantity"}}
            },
            {$sort:{totalSold : -1}},
            {$limit:10},
            {
                $lookup:{
                    from:"products",
                    localField:"_id",
                    foreignField:"_id",
                    as:"product"
                }
            },
            //(Lookup always return an array)
            {$unwind:"$product"}
        ])

        //Best selling category (top 10) 
        const bestCategories = await Order.aggregate([
            {$unwind:"$items"},
            {
                $lookup:{
                    from:"products",
                    localField:"items.productId",
                    foreignField:"_id",
                    as:"product"
                }
            },
            {$unwind:"$product"},
            {$group:{
                _id:"$product.category",
                totalSold:{$sum:"$items.quantity"}
                }
            },
            {$sort:{totalSold:-1}},
            {$limit:10},
            {
                $lookup:{
                    from:"categories",
                    localField:"_id",
                    foreignField:"_id",
                    as:"category"
                }
            },
            {$unwind:"$category"}
        ])

        const recentOrders = await Order
            .find()
            .sort({orderDate:-1})
            .limit(5)
            .populate("userId");


        res.render("dashboard",{
            totalUsers,
            totalOrders,
            totalRevenue,
            bestProducts,
            bestCategories,
            recentOrders
        })

    } catch (error) {
        authLogger.error(
          `ADMIN DASHBOARD ERROR | AdminId: ${req.session.admin} | Route: ${req.originalUrl} | Message: ${error.message} | IP: ${req.ip}`
        );
        next(error)
    }
}

//sales chart

const getSalesChart = async (req,res,next)=>{
    try {
        const filter = req.query.filter;
        let groupStage;
        if(filter === "daily"){
            groupStage = {
                year:{$year:"$orderDate"},
                month:{$month:"$orderDate"},
                day:{$dayOfMonth:"$orderDate"}
            }
        }else if(filter === "monthly"){
            groupStage = {
                year:{$year:"$orderDate"},
                month:{$month:"$orderDate"}
            }
        }else{
            groupStage = {
                year:{$year:"$orderDate"}
            }
        }

        const sales = await Order.aggregate([
            {
                $group:{
                    _id:groupStage,
                    revenue:{$sum:"$totalAmount"}
                }
            },
            {
                $sort:{
                    "_id.year":1,
                    "_id.month":1,
                    "_id.day":1
                }
            }
        ])

        res.json(sales)


    } catch (error) {
        authLogger.error(
            `ADMIN SALES CHART ERROR | AdminId: ${req.session.admin} | Filter: ${req.query.filter} | Message: ${error.message} | IP: ${req.ip}`
        );
        next(error)
    }
}

const logout = async (req,res,next)=>{
    try {
        const adminId = req.session.admin;

        authLogger.info(
            `ADMIN LOGOUT | AdminId: ${adminId} | IP: ${req.ip}`
        );
        req.session.admin = null;   
        return res.redirect("/admin/login");
    } catch (error) {
        next(error);
    }
}


export default {
  loadLogin,
  login,
  loadDashboard,
  getSalesChart,
  pageerror,
  logout,
};
