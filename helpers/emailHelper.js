const nodemailer = require("nodemailer");
const env = require("dotenv").config();

//send Email with OTP
const sendVerificationEmail = async (email,otp, subject)=>{
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

        const mailOptions = {
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject: subject || "Your OTP",
            text:`<b><h1>Your OTP is ${otp}</h1><b>`,
            html:`<b><h3>Your OTP is ${otp}</h3><b>`
        }

        const info = await transporter.sendMail(mailOptions);
        console.log("Email send:",info.messageId);
        return true;

    } catch (error) {
        console.error("Error sending email",error);
        return false;
    }
}

module.exports = { sendVerificationEmail };
