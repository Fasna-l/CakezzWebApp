//Generate 6-digit OTP (Reusable)
function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

export { generateOtp };