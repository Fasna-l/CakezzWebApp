const User = require("../../models/userSchema")
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");


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
                // req.session.admin = true;
                req.session.admin = admin._id; //Pending :admin session management
                return res.redirect("/admin")
            }else{
                // return res.redirect("/login")
                res.render("admin-login", { message: "Invalid email or password" });
            }
        }else{
            // return res.redirect("/login")
            res.render("admin-login", { message: "Invalid email or password" });
        }
    } catch (error) {
        next(error);
        // console.log("login error",error);
        // return res.redirect("/pageerror")
    }
}

const loadDashboard = async (req,res,next)=>{
    if(req.session.admin){
        try {
            res.render("dashboard")
        } catch (error) {
            next(error);
            // res.redirect("/pageerror")
        }
    }
}

const logout = async (req,res,next)=>{
    try {
        req.session.admin = null;   // ❗ONLY CLEAR ADMIN
        return res.redirect("/admin/login");
    } catch (error) {
        next(error);
        // console.log("Logout error",error);
        // res.redirect("/admin/pageerror");
    }
}


module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
}
