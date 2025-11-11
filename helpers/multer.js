// const multer = require("multer");
// const storage = multer.memoryStorage();

// const fileFilter = (req, file, cb) => {
//   const allowedTypes = /jpg|jpeg|png|webp|avif|jfif/;
//   const mimeTypeValid = allowedTypes.test(file.mimetype);
//   const extValid = allowedTypes.test(file.originalname.toLowerCase().split('.').pop());

//   if (mimeTypeValid && extValid) {
//     cb(null, true);
//   } else {
//     cb(new Error("Only image files are allowed!"), false);
//   }
// };

// const uploads = multer({ storage: storage, fileFilter: fileFilter });

// module.exports = { storage, uploads };

const multer = require("multer");
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // ✅ Allowed MIME types (actual browser values)
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif"
  ];

  // ✅ Allowed extensions (for file name check)
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
