import User from "../../models/userSchema.js";
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
    if(req.session.admin){
        try {
            res.render("dashboard")
        } catch (error) {
            next(error);
        }
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
  pageerror,
  logout,
};
