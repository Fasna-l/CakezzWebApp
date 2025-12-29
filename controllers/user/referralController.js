const User = require("../../models/userSchema");

const generateReferralCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

const loadReferralPage = async (req, res, next) => {
  try {
    const userId = req.session.user;

    let user = await User.findById(userId);

    if (!user) {
      return res.redirect("/login");
    }

    //  IMPORTANT FIX: generate code for old users
    if (!user.referralCode) {
      user.referralCode = generateReferralCode();
      await user.save();
    }

    res.render("referral", {
      user: user.toObject()
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  loadReferralPage
};
