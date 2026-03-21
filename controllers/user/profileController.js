import path from "path";
import fs from "fs";
import sharp from "sharp";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

import User from "../../models/userSchema.js";
import Otp from "../../models/otpSchema.js";
import HTTP_STATUS from "../../utils/httpStatus.js";
import RESPONSE_MESSAGES from "../../utils/responseMessages.js";

import { generateOtp } from "../../helpers/otpHelper.js";
import { sendVerificationEmail } from "../../helpers/emailHelper.js";
import { securePassword } from "../../helpers/passwordHelper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

//Load Account page(Profile Page)
const loadAccountPage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId).lean();
    // Fetch addresses or orders later
    res.render("account", {
      user
    });
  } catch (error) {
    next(error);
  }
};

// Load Edit Profile Page
const loadEditProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user);
    if (!user) return res.redirect("/login");

    res.render("edit-profile", { user });
  } catch (error) {
    next(error);
  }
};

// Update Profile - POST
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const { name, email } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.redirect("/login");

    // Prepare update data
    const updateData = { name };
    // Block Google users from editing email
    if (user.isGoogleUser) {
      updateData.email = user.email;   // Google user can't change email
    }
    // Handle new profile image upload
    if (req.file) {
      console.log(" File received from Multer:", req.file.originalname);

      //  Ensure the profile folder exists
      const profileDir = path.join(__dirname, "../../public/uploads/profile");
      if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
      }

      //  Create a unique filename
      const filename = `${Date.now()}-${req.file.originalname}`;
      const uploadPath = path.join(profileDir, filename);

      try {
        //  Compress & save image using Sharp
        await sharp(req.file.buffer)
          .resize(300, 300, { fit: "cover" })
          .jpeg({ quality: 85 })
          .toFile(uploadPath);

        //  Delete old profile image if it exists
        if (user.profileImage) {
          const oldPath = path.join(profileDir, user.profileImage);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        //  Save new image filename to DB
        updateData.profileImage = filename;
        console.log(" Profile image saved successfully:", filename);
      } catch (err) {
        console.error(" Sharp image processing failed:", err);
      }
    } else {
      console.warn(" No image file received from frontend.");
    }

    // Handle email change (OTP later)
    if(!user.isGoogleUser){
      if (email !== user.email) {
        req.session.tempProfileData = {
          userId,
          name,
          email,
          profileImage: updateData.profileImage || user.profileImage,
        };
        console.log("Email changed — OTP verification to be added soon.");
        return res.redirect("/change-email");
      } else {
        updateData.email = email;
      }
    }
    

    //  Save to database
    await User.findByIdAndUpdate(userId, updateData);

    console.log("Profile updated successfully!");
    res.redirect("/account");
  } catch (error) {
    next(error);
  }
};
  
// ================= EMAIL CHANGE FLOW =================
// Load Email Change Page
const loadEmailChangePage = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user).lean();
    if (user.isGoogleUser) {
      return res.redirect("/account");
    }

    res.render("email-change", {user, message: "" });
  } catch (error) {
    next(error);
  }
};

// Step 1: Validate and send OTP
const sendEmailChangeOtp = async (req, res, next) => {
  try {
    const { oldEmail, newEmail } = req.body;
    const userId = req.session.user;

    const user = await User.findById(userId);
    if (user.isGoogleUser) {
      return res.render("email-change", { user, message: RESPONSE_MESSAGES.GOOGLE_EMAIL_CHANGE_NOT_ALLOWED });
    }

    if (!user) return res.render("email-change", { user:null, message: RESPONSE_MESSAGES.USER_NOT_FOUND });
    if (user.email !== oldEmail) {
      return res.render("email-change", { user, message: RESPONSE_MESSAGES.EMAIL_MISMATCH });
    }

    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) {
      return res.render("email-change", { user, message: RESPONSE_MESSAGES.EMAIL_ALREADY_EXISTS });
    }

    const otp = generateOtp();
    await Otp.deleteOne({ email: newEmail });
    await Otp.create({ email: newEmail, otp });

    const emailSent = await sendVerificationEmail(newEmail, otp, "OTP to verify your new email address");
    if (!emailSent) {
      return res.render("email-change", { user, message: RESPONSE_MESSAGES.EMAIL_SEND_FAILED });
    }

    req.session.newEmail = newEmail;
    console.log("Email Change OTP:", otp);
    res.render("emailChange-otp",{user});
  } catch (error) {
    next(error);
  }
};

// Step 2: Verify OTP and update email
const verifyEmailChangeOtp = async (req, res, next) => {
  try {
    const { otp } = req.body;

    if (!otp || otp.trim() === "") {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.OTP_REQUIRED
      });
    }
    const userId = req.session.user;
    const newEmail = req.session.newEmail;

    if (!userId)
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: RESPONSE_MESSAGES.LOGIN_REQUIRED
      });

    if (!newEmail)
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.SESSION_EXPIRED
      });

    const otpRecord = await Otp.findOne({ email: newEmail });

    if (!otpRecord)
       return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.OTP_EXPIRED
      });
    if (otpRecord.otp !== otp) 
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.OTP_INVALID
      });

    await User.findByIdAndUpdate(userId, { email: newEmail });
    await Otp.deleteOne({ email: newEmail });
    delete req.session.newEmail;

    return res.json({
      success: true,
      message: RESPONSE_MESSAGES.EMAIL_UPDATED
    });
  } catch (error) {
    next(error);
  }
};

// Step 3: Resend OTP
const resendEmailChangeOtp = async (req, res, next) => {
  try {
    const newEmail = req.session.newEmail;
    if (!newEmail) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.SESSION_EXPIRED
      });
    }

    const otp = generateOtp();
    await Otp.deleteOne({ email: newEmail });
    await Otp.create({ email: newEmail, otp });
    await sendVerificationEmail(newEmail, otp, "Resent OTP for Email Change Verification");

    console.log("Resent OTP:", otp);
    res.json({
      success: true,
      message: RESPONSE_MESSAGES.OTP_RESENT
    });
  } catch (error) {
    next(error);
  }
};

const getForgotPassPage = async (req,res,next)=>{
    try {
        res.render("forgot-password")
    } catch (error) {
      next(error);
    }
}

const forgotEmailValid = async (req,res,next)=>{
    try {
        const {email} = req.body;
        const findUser = await User.findOne({email:email});
        if(findUser){
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email,otp,"Your OTP for Password Reset");
            if(emailSent){
                // OTP in Database
                await Otp.deleteOne({email});
                await Otp.create({email,otp});

                req.session.email = email  

                res.render("forgotPass-otp");
                console.log("OTP:",otp)
            }else{
                res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                  success:false,
                  message: RESPONSE_MESSAGES.SERVER_ERROR
                });
            }
        }else{
            res.render("forgot-password",{
                message:RESPONSE_MESSAGES.USER_NOT_FOUND
            });
        }
    } catch (error) {
      next(error);
    }
}

const verifyForgotPassOtp = async (req, res,next) => {
  try {
    const enteredOtp = req.body.otp;
    const email = req.session.email;

    if (!email) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.SESSION_EXPIRED
      });
    }

    //  Check OTP from DB
    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.OTP_EXPIRED
      });
    }

    if (enteredOtp !== otpRecord.otp) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.OTP_INVALID
      });
    }

    //  Delete OTP after successful match(verification)
    await Otp.deleteOne({ email });

    res.json({ success: true, redirectUrl: "/reset-password" });

  } catch (error) {
    next(error);
  }
};

const getResetPassPage = async (req,res,next)=>{
    try {
        res.render("reset-password");
    } catch (error) {
      next(error);
    }
}

const resendOtp = async (req,res,next)=>{
    try {
        //access email from the session
        const email = req.session.email;
        console.log(email)
        if (!email) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
              success: false,
              message: RESPONSE_MESSAGES.SESSION_EXPIRED
            });
        }
        const otp = generateOtp();
        // OTP in DB
        await Otp.deleteOne({email});
        await Otp.create({email,otp})
        
        console.log("Resending OTP to email:",email);
        const emailSent = await sendVerificationEmail(email,otp,"OTP for Password Reset");
        if(emailSent){
            console.log("Resend-OTP:",otp);
            res.status(HTTP_STATUS.OK).json({
              success:true,
              message: RESPONSE_MESSAGES.OTP_RESENT
            });
        }
    } catch (error) {
      next(error);
    }
}

const postNewPassword = async (req,res,next)=>{
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
            res.render("reset-password",{message: RESPONSE_MESSAGES.PASSWORD_MISMATCH})
        } 
    } catch (error) {
      next(error);
    }
}

//change Password
const getChangePasswordPage = async (req, res,next) => {
  try {
    const userId = req.session.user; // currently an ID
    const user = await User.findById(userId);
    //  Block Google users completely
    if (!user || user.isGoogleUser) {
      return res.redirect("/account");
    }
    res.render("password",{user});
  } catch (error) {
    next(error);
  }
};

const postChangePassword = async (req, res, next) => {
  try { 
    const { oldpassword, newpassword, Confirmpassword } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId); 

    if (user.isGoogleUser) {
      return res.redirect("/account");
    }
    const isMatch = await bcrypt.compare(oldpassword, user.password);
    if (!isMatch) {
      return res.render("password", {
        user,
        message: RESPONSE_MESSAGES.OLD_PASSWORD_INCORRECT,
      });
    }

    if (newpassword !== Confirmpassword) {
      return res.render("password", {
        user,
        message: RESPONSE_MESSAGES.PASSWORD_MISMATCH,
      });
    }

    const passwordHash = await securePassword(newpassword);
    await User.updateOne({ _id: userId }, { $set: { password: passwordHash } });

    // Redirect back to password page with success flash message
    res.render("password", {
      user,
      successMessage: RESPONSE_MESSAGES.PASSWORD_CHANGED,
    });
  } catch (error) {
    next(error);
  } 
};

export default {
  loadAccountPage,
  loadEditProfile,
  updateProfile,
  loadEmailChangePage,
  sendEmailChangeOtp,
  verifyEmailChangeOtp,
  resendEmailChangeOtp,
  getForgotPassPage,
  forgotEmailValid,
  verifyForgotPassOtp,
  getResetPassPage,
  resendOtp,
  postNewPassword,
  getChangePasswordPage,
  postChangePassword,
};