const User = require("../models/userSchema");

const userAuth = async (req, res, next) => {
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
      req.session.user = null; // Only remove user session, not destroy whole session
      return res.redirect("/login?message=Your account is blocked");
    }

    next();
  } catch (error) {
    console.log("Error in userAuth middleware", error);
    return res.redirect("/login");
  }
};

const adminAuth = (req, res, next) => {    // pending: admin session management(completely change the adminAuth middleware function to this)
    if (req.session.admin) {
        next();
    } else {
        res.redirect("/admin/login");
    }
};

module.exports = {
    userAuth,
    adminAuth
}