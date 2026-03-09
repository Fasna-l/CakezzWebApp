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

//sidebar active(admin side)
export const setActivePage = (req, res, next) => {

  const path = req.path;

  if (path === "/" || path === "/dashboard") {
    res.locals.activePage = "dashboard";
  } 
  else if (path.startsWith("/products")) {
    res.locals.activePage = "products";
  } 
  else if (path.startsWith("/orders")) {
    res.locals.activePage = "orders";
  } 
  else if (path.startsWith("/return-requests")) {
    res.locals.activePage = "returns";
  } 
  else if (path.startsWith("/users")) {
    res.locals.activePage = "users";
  } 
  else if (path.startsWith("/sales-report")) {
    res.locals.activePage = "sales";
  } 
  else if (path.startsWith("/coupons")) {
    res.locals.activePage = "coupons";
  } 
  else if (path.startsWith("/referrals")) {
    res.locals.activePage = "referrals";
  } 
  else if (path.startsWith("/category")) {
    res.locals.activePage = "category";
  } 
  else if (path.startsWith("/banners")) {
    res.locals.activePage = "banners";
  }

  next();
};