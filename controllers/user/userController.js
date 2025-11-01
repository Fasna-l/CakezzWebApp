const User = require("../../models/userSchema");
const Otp = require("../../models/otpSchema");  // import OTP Model
const env = require("dotenv").config();
const bcrypt = require("bcrypt");
const { generateOtp } = require("../../helpers/otpHelper");
const { sendVerificationEmail } = require("../../helpers/emailHelper");
const { securePassword } = require("../../helpers/passwordHelper");

const pageNotFound = async (req,res)=>{
    try {
        res.render("pageNotFound")
    } catch (error) {
        res.redirect("pageNotFound")
    }
}

const googleAuth = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      throw new Error("User not found in req.user");
    }

    if (user.isBlocked) {
      return res.render("login", {
        message: "User is blocked by the admin",
        icon: "warning",
      });
    }

    req.session.user = user._id;
    res.redirect("/?message=Logged in with Google successfully&icon=success");
  } catch (error) {
    console.error("Google Authentication Error:", error);
    res.redirect("/login?message=Google login failed&icon=warning");
  }
};

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


const signup = async (req,res) =>{
    try {
        
        const {name,email,password,confirmPassword} = req.body;

        if(password !== confirmPassword){
            return res.render("signup",{message:"Passwords do not match"});
        }

        const findUser = await User.findOne({email});
        if(findUser){
            return res.render("signup",{
                message:"User with this email already exists",
                icon: "warning",
            });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email,otp,"Verify your account");
        if (!emailSent) {
            console.log("Email sending failed");
            return res.render("signup", {
                message: "Failed to send OTP. Please try again.",
                icon: "warning",
            });
        }

        // req.session.userOtp = otp;
        // req.session.userData = { name, email, password };

        // Store OTP in DB (Replace session-based storage)
        await Otp.deleteOne({email}); //remove old OTP if exists
        await Otp.create({email,otp});

        req.session.userData = { name, email, password };
        
        res.render("verify-otp");
        console.log("OTP Send",otp)

    } catch (error) {
        
        console.error("signup error",error);
        res.redirect("/pageNotFound")

    }
}

const verifyOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        const { email, name, password } = req.session.userData || {};

        if (!email) {
            return res.status(400).json({ success: false, message: "Session expired. Please signup again." });
        }

        // Fetch OTP from DB
        const otpRecord = await Otp.findOne({ email });

        if (!otpRecord) {
            return res.json({ success: false, message: "OTP expired or not found. Please resend." });
        }

        if (otpRecord.otp !== enteredOtp) {
            return res.json({ success: false, message: "Invalid OTP" });
        }

        //  Save user after OTP match
        //const hashedPassword = await bcrypt.hash(password, 10);
        const hashedPassword = await securePassword(password);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        req.session.user = newUser._id;
        console.log("User data saved successfully");

        // Remove OTP from DB
        await Otp.deleteOne({ email });

        res.json({ success: true, redirectUrl: "/login" });

    } catch (error) {
        console.error("OTP Verify Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

//resendotp
const resendOtp = async(req,res)=>{
    try {

        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }

        const otp = generateOtp();
        // req.session.userOtp = otp;
        await Otp.deleteOne({email});
        await Otp.create({email,otp});

        const emailSent = await sendVerificationEmail(email,otp,"Your OTP for Account Verification")
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
    googleAuth,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    loadShoppage
}
