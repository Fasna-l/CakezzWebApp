const User = require("../../models/userSchema");
const Otp = require("../../models/otpSchema");  // import OTP Model
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const { generateOtp } = require("../../helpers/otpHelper");
const { sendVerificationEmail } = require("../../helpers/emailHelper");
const { securePassword } = require("../../helpers/passwordHelper");
//const session = require("express-session"); already using express-session in app.js so no need to import here  

const getForgotPassPage = async (req,res)=>{
    try {
        res.render("forgot-password")
    } catch ({error}) {
        res.redirect("/pageNotFound")
    }
}

const forgotEmailValid = async (req,res)=>{
    try {
        const {email} = req.body;
        const findUser = await User.findOne({email:email});
        if(findUser){
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email,otp,"Your OTP for Password Reset");
            if(emailSent){
                // req.session.userOtp = otp;
                // req.session.email = email;
                
                // OTP in Database
                await Otp.deleteOne({email});
                await Otp.create({email,otp});

                req.session.email = email  //Store email temporarily in session only (not OTP)

                res.render("forgotPass-otp");
                console.log("OTP:",otp)
            }else{
                res.json({success:false,message:"Failed to send OTP. Please try again"});
            }
        }else{
            res.render("forgot-password",{
                message:"User with this email does not exist"
            });
        }
    } catch (error) {
        console.error("Forgot Password error:", error);
        res.redirect("/pageNotFound")
    }
}

const verifyForgotPassOtp = async (req, res) => {
  try {
    const enteredOtp = req.body.otp;
    const email = req.session.email;

    if (!email) {
      return res.json({ success: false, message: "Session expired. Try again." });
    }

    //  Check OTP from DB
    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord) {
      return res.json({ success: false, message: "OTP expired. Please resend." });
    }

    if (enteredOtp !== otpRecord.otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    //  Delete OTP after successful match(verification)
    await Otp.deleteOne({ email });

    res.json({ success: true, redirectUrl: "/reset-password" });

  } catch (error) {
    console.error("Verify Forgot OTP Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


const getResetPassPage = async (req,res)=>{
    try {
        res.render("reset-password");
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const resendOtp = async (req,res)=>{
    try {
        //access email from the session
        const email = req.session.email;
        console.log(email)
        if (!email) {
            return res.status(400).json({success: false,message: "Session expired. Please go back and enter your email again."});
        }
        const otp = generateOtp();
        // req.session.userOtp = otp;

        // OTP in DB
        await Otp.deleteOne({email});
        await Otp.create({email,otp})
        
        console.log("Resending OTP to email:",email);
        const emailSent = await sendVerificationEmail(email,otp,"OTP for Password Reset");
        if(emailSent){
            console.log("Resend-OTP:",otp);
            res.status(200).json({success:true,message:"Resend OTP Succssful"})
        }
    } catch (error) {
        console.error("Error in Resend otp",error);
        res.status(500).json({success:false,message:"Internal Server Error"});
    }
}

const postNewPassword = async (req,res)=>{
    try {
        const {password, confirmPassword} = req.body;
        const email = req.session.email;
        if(password === confirmPassword){
            const passwordHash = await securePassword(password);
            await User.updateOne(
                {email:email},
                {$set:{password:passwordHash}}
            )
            res.redirect("/login");
        }else{
            res.render("reset-password",{message:"Passwords do not match"})
        } 
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.redirect("/pageNotFound")
    }
}



//change Password
// GET change password page
const getChangePasswordPage = async (req, res) => {
  try {
    const userId = req.session.user; // currently an ID
    const user = await User.findById(userId);
    res.render("password",{user});
  } catch (error) {
    console.error("Change Password Page Error:", error);
    res.redirect("/pageNotFound");
  }
};

// POST change password logic
const postChangePassword = async (req, res) => {
  try { 
    const { oldpassword, newpassword, Confirmpassword } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId);
    const isMatch = await bcrypt.compare(oldpassword, user.password);

    if (!isMatch) {
      return res.render("password", {
        user,
        message: "Old password is incorrect",
      });
    }

    if (newpassword !== Confirmpassword) {
      return res.render("password", {
        user,
        message: "New passwords do not match",
      });
    }

    const passwordHash = await securePassword(newpassword);
    await User.updateOne({ _id: userId }, { $set: { password: passwordHash } });

    // Redirect back to password page with success flash message
    res.render("password", {
      user,
      successMessage: "Password changed successfully!",
    });
  } catch (error) {
    console.error("Change Password Error:", error);
    res.redirect("/pageNotFound");
  }
};


module.exports ={
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    getChangePasswordPage,
    postChangePassword,
}