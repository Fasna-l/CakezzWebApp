import logger from "../utils/logger.js";

const errorHandler = (err, req, res, next) => {
  logger.error(`${err.message} - ${req.method} ${req.originalUrl}`);
  //console.error("Error:", err);

  // API requests (fetch / ajax)
  if (req.headers.accept?.includes("application/json")) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }

  // ADMIN side error page
  if (req.originalUrl.startsWith("/admin")) {
    return res.status(err.status || 500).redirect("/admin/pageerror");
  }

  // USER side error page
  return res.status(err.status || 500).redirect("/pageNotFound");
};

export default errorHandler;