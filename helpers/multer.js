const multer = require("multer");
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allowed MIME types (actual browser values)
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif"
  ];

  // Allowed extensions (for file name check)
  const allowedExtensions = ["jpg", "jpeg", "png", "webp", "avif", "jfif"];

  const fileExt = file.originalname.split(".").pop().toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(fileExt)) {
    cb(null, true);
  } else {
    console.log("❌ Rejected file:", file.originalname, "| Type:", file.mimetype);
    cb(new Error("Only image files are allowed!"), false);
  }
};
const uploads = multer({ storage, fileFilter });

module.exports = { storage, uploads };
