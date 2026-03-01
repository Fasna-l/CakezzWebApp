import User from "../models/userSchema.js";

export const userAuth = async (req, res, next) => {
  try {
    if (!req.session.user) {
      return res.redirect("/login");
    }

    const user = await User.findById(req.session.user);

    if (!user) {
      req.session.user = null;
      return res.redirect("/login");
    }

    if (user.isBlocked) {
      req.session.user = null;
      return res.redirect("/login?message=Your account is blocked");
    }

    next();
  } catch (error) {
    console.log("Error in userAuth middleware", error);
    return res.redirect("/login");
  }
};

export const adminAuth = (req, res, next) => {
  if (req.session.admin) {
    next();
  } else {
    res.redirect("/admin/login");
  }
};