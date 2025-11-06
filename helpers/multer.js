const multer = require("multer");
const storage = multer.memoryStorage();

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpg|jpeg|png|webp|avif/;
  const mimeTypeValid = allowedTypes.test(file.mimetype);
  const extValid = allowedTypes.test(file.originalname.toLowerCase().split('.').pop());

  if (mimeTypeValid && extValid) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const uploads = multer({ storage: storage, fileFilter: fileFilter });

module.exports = { storage, uploads };

