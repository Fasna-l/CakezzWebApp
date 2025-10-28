const User = require("../../models/userSchema");
const env = require("dotenv").config();
const nodemailer  = require("nodemailer");
const bcrypt = require("bcrypt");

const pageNotFound = async (req,res)=>{
    try {
        res.render("pageNotFound")
    } catch (error) {
        res.redirect("pageNotFound")
    }
}



//Load Home Page

const loadHomepage = async (req,res)=>{
    try {
        const user = req.session.user;
        //console.log("loadhome",user)
        if(user){
            const userData = await User.findOne({_id:user});
            //console.log("userData",userData);
            res.render("home",{user:userData})
            
        }else{
            return res.render("home");
        }
    } catch (error) {
        console.log("Home page not found");
        res.status(500).send("server error");
    }
}

//Load Login

const loadLogin = async (req,res)=>{
    try {
        if(!req.session.user){
            return res.render("login")
        }else{
            res.redirect("/")
        }
    } catch (error) {
        res.redirect("pageNotFound")
    }
}

const login = async (req,res)=>{
    try {
        const {email,password} = req.body;

        const findUser = await User.findOne({isAdmin:0,email:email});

        if(!findUser){
            return res.render("login",{message:"We couldn't find an account with this email. Please try again or sign up."});
        }
        if(findUser.isBlocked){
            return res.render("login",{message:"Your account has been disabled. Please contact our team for assistance."})
        }

        const passwordMatch = await bcrypt.compare(password,findUser.password);

        if(!passwordMatch){
            return res.render("login",{message:"Incorrect Password"})
        }

        req.session.user = findUser._id
        //console.log(req.session.user)
        //console.log("session is there")
        res.redirect("/");

    } catch (error) {
        console.error("login error",error);
        res.render("login",{message:"login failed. Please try again later"});
    }
}
//Load Signup page

const loadSignup = async (req,res)=>{
    try {
        return res.render("signup")
    } catch (error) {
        console.log("Signup page is not loading",error);
        res.status(500).send("Server Error")
    }
}

function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

async function sendVerificationEmail(email,otp){
    try {
        
        const transporter = nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"verify your account",
            text:`<b><h1>Your OTP is ${otp}</h1><b>`,
            html:`<b><h3>Your OTP is ${otp}</h3><b>`

        })

        return info.accepted.length >0

    } catch (error) {
        console.error("Error sending email",error);
        return false;
    }
}

const signup = async (req,res) =>{
    try {
        
        const {name,email,password,confirmPassword} = req.body;

        if(password !== confirmPassword){
            return res.render("signup",{message:"Passwords does not match"});
        }

        const findUser = await User.findOne({email});
        if(findUser){
            return res.render("signup",{
                message:"User with this email already exists",
                icon: "warning",
            });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email,otp);
        if (!emailSent) {
            console.log("Email sending failed");
            return res.render("signup", {
                message: "Failed to send OTP. Please try again.",
                icon: "warning",
            });
        }

        req.session.userOtp = otp;
        req.session.userData = { name, email, password };

        res.render("verify-otp");
        console.log("OTP Send",otp)

    } catch (error) {
        
        console.error("signup error",error);
        res.redirect("/pageNotFound")

    }
}

const securePassword = async(password)=>{
    try {
        
        const passwordHash = await bcrypt.hash(password,10);
        return passwordHash;

    } catch (error) {
        console.log("securePassword error", error);
    }
}


//verifyOtp 

const verifyOtp = async (req,res)=>{
    try {
        
        const {otp} = req.body;
        console.log(otp);

        if(otp===req.session.userOtp){
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);


            const saveUserData = new User({
                name:user.name,
                email:user.email,
                password:passwordHash,
            })
            await saveUserData.save();
            req.session.user = saveUserData._id;
            console.log("User data saved successfully");
            res.json({success:true,redirectUrl:"/login"})

        }else {
             res.status(400).json({success:false,message:"Invalid OTP, Please try again"})
        }
    } catch (error) {
        
        console.error("Error Verifying OTP",error);
        res.status(500).json({success:false,message:"An error occured"});

    }
}


//resendotp
const resendOtp = async(req,res)=>{
    try {

        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }

        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email,otp)
        if(emailSent){
            console.log("Resend OTP:",otp);
            res.status(200).json({success:true,message:"OTP Resend Successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to resend OTP. Please try again"});
        }
    } catch (error) {
        console.error("Error resending otp",error);
        res.status(500).json({success:false,message:"Internal Server Error. Please try again"})
    }
}

const logout = async (req,res)=>{
    try {
        
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error",err.message);
                return res.redirect("/pageNotFound");
            }
            return res.redirect("/login")
        })

    } catch (error) {
        
        console.log("Logout error",error);
        res.redirect("/pageNotFound")

    }
}

//Load Shop Page

const loadShoppage = async (req,res)=>{
    try {
        return res.render("shop")
    } catch (error) {
        
        console.log("Shopping page not loading",error);
        res.status(500).send("Server Error")
    }
}

module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    loadShoppage
}
