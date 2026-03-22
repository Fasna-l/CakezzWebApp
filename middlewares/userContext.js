import User from "../models/userSchema.js";

const userContext = async (req, res, next) => {
  try {
    if (req.session.user) {
      res.locals.user = await User.findById(req.session.user).lean();
    } else {
      res.locals.user = null;
    }
    next();
  } catch (error) {
    console.log("userContext middleware error:", error);
    res.locals.user = null;
    next();
  }
};

export default userContext;