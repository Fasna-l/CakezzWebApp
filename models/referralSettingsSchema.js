import mongoose from "mongoose";

const referralSettingsSchema = new mongoose.Schema({
  referrerReward: {
    type: Number,
    default: 50
  },
  refereeReward: {
    type: Number,
    default: 50
  }
}, { timestamps: true });

const ReferralSettings = mongoose.model("ReferralSettings", referralSettingsSchema);

export default ReferralSettings;