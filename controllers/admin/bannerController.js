import Banner from "../../models/bannerSchema.js";
import fs from "fs";
import path from "path";

import HTTP_STATUS from "../../utils/httpStatus.js";
import RESPONSE_MESSAGES from "../../utils/responseMessages.js";

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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.BANNER_IMAGE_REQUIRED
      });
    }

    const bannerCount = await Banner.countDocuments();

    if (bannerCount >= 10) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.MAX_BANNER_LIMIT
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

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: RESPONSE_MESSAGES.SUCCESS
    });

  } catch (error) {
    next(error);
  }
};

const deleteBanner = async (req, res, next) => {
  try {

    const id = req.params.id;

    const bannerCount = await Banner.countDocuments();

    if (bannerCount <= 3) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: RESPONSE_MESSAGES.MIN_BANNER_LIMIT
      });
    }

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: RESPONSE_MESSAGES.BANNER_NOT_FOUND
      });
    }

    const filePath = `public/uploads/banner/${banner.bannerImage}`;

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Banner.findByIdAndDelete(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: RESPONSE_MESSAGES.SUCCESS
    });

  } catch (error) {
    next(error);
  }
};

export default {
  loadBannerPage,
  addBanner,
  deleteBanner
};