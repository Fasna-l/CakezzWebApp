import User from "../../models/userSchema.js";
import ReferralSettings from "../../models/referralSettingsSchema.js";
import Wallet from "../../models/walletSchema.js";

const loadReferralPage = async (req, res, next) => {
  try {

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    // get users with referral code
    const users = await User.find({
      referralCode: { $exists: true, $ne: null }
    })
    .sort({ createdOn: -1 })
    .lean();

    // collect referral data
    const referralData = await Promise.all(
  users.map(async (user) => {

    // find users referred by this user
    const referredUsers = await User.find({
      referredBy: user._id
    }).select("_id name");

    if (referredUsers.length === 0) return null;

    const referredIds = referredUsers.map(u => u._id);

    // -------- TOTAL GIVEN (Signup rewards) --------
    const refereeWallets = await Wallet.find({
      userId: { $in: referredIds }
    });

    let totalGiven = 0;

    refereeWallets.forEach(wallet => {
      wallet.transactions.forEach(tx => {
        if (tx.type === "referral" && tx.description === "Referral signup bonus") {
          totalGiven += tx.amount;
        }
      });
    });

    // -------- TOTAL EARNED (First order reward) --------
    const referrerWallet = await Wallet.findOne({ userId: user._id });

    let totalEarned = 0;

    if (referrerWallet) {
      referrerWallet.transactions.forEach(tx => {
        if (tx.type === "referral" && tx.description.includes("first order")) {
          totalEarned += tx.amount;
        }
      });
    }

    return {
      ...user,
      referredCount: referredUsers.length,
      totalGiven,
      totalEarned
    };

  })
);

    // remove users with no referrals
    const filteredReferrals = referralData.filter(Boolean);

    const totalUsers = filteredReferrals.length;

    const paginatedReferrals = filteredReferrals.slice(skip, skip + limit);

    const totalPages = Math.ceil(totalUsers / limit);

    let settings = await ReferralSettings.findOne();
    if(!settings){
      settings = await ReferralSettings.create({
        referrerReward: 50,
        refereeReward:50
      })
    }
    res.render("referralList", {
      referrals: paginatedReferrals,
      currentPage: page,
      totalPages,
      settings
    });

  } catch (error) {
    next(error);
  }
};

const updateReferralSettings = async (req,res,next)=>{
  try{

    const { referrerReward, refereeReward } = req.body;

    let settings = await ReferralSettings.findOne();

    if(!settings){
      settings = new ReferralSettings();
    }

    settings.referrerReward = Number(referrerReward);
    settings.refereeReward = Number(refereeReward);

    await settings.save();

    res.redirect("/admin/referrals");

  }catch(error){
    next(error);
  }
};

export default {
  loadReferralPage,
  updateReferralSettings
};