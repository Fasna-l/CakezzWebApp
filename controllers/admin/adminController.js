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
                req.session.admin = admin._id;
                return res.redirect("/admin")
            }else{
                res.render("admin-login", { message: "Invalid email or password" });
            }
        }else{
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
        req.session.admin = null;   
        return res.redirect("/admin/login");
    } catch (error) {
        next(error);
    }
}


module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
}
