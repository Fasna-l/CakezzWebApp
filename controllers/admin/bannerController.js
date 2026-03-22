import Banner from "../../models/bannerSchema.js";
import fs from "fs";
import path from "path";

const loadBannerPage = async (req, res, next) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });

    res.render("banners", {
      banners,
      bannerCount: banners.length
    });

  } catch (error) {
    next(error);
  }
};

const addBanner = async (req, res, next) => {
  try {

    if (!req.file) {
      return res.json({
        success: false,
        message: "Please upload a banner image"
      });
    }

    const bannerCount = await Banner.countDocuments();

    if (bannerCount >= 10) {
      return res.json({
        success: false,
        message: "Maximum 10 banners allowed"
      });
    }

    const bannerDir = "public/uploads/banner";

    if (!fs.existsSync(bannerDir)) {
      fs.mkdirSync(bannerDir, { recursive: true });
    }

    const fileName = Date.now() + "-" + req.file.originalname;

    const filePath = path.join(bannerDir, fileName);

    fs.writeFileSync(filePath, req.file.buffer);

    const newBanner = new Banner({
      bannerImage: fileName
    });

    await newBanner.save();

    res.json({ success: true });

  } catch (error) {
    next(error);
  }
};

const deleteBanner = async (req, res, next) => {
  try {

    const id = req.params.id;

    const bannerCount = await Banner.countDocuments();

    if (bannerCount <= 3) {
      return res.json({
        success: false,
        message: "Minimum 3 banners required"
      });
    }

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.json({
        success: false,
        message: "Banner not found"
      });
    }

    const filePath = `public/uploads/banner/${banner.bannerImage}`;

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Banner.findByIdAndDelete(id);

    res.json({ success: true });

  } catch (error) {
    next(error);
  }
};

export default {
  loadBannerPage,
  addBanner,
  deleteBanner
};