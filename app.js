import express from "express";
import path from "path";
import dotenv from "dotenv";
import session from "express-session";
import nocache from "nocache";

import db from "./config/db.js";
import passport from "./config/passport.js";
import userRouter from "./routes/userRouter.js";
import adminRouter from "./routes/adminRouter.js";
import paymentRouter from "./routes/paymentRouter.js";
import errorHandler from "./middlewares/errorHandler.js";
import userContext from "./middlewares/userContext.js";
import cartCount from "./middlewares/cartCount.js";
import wishlistCount from "./middlewares/wishlistCount.js";
import methodOverride from "method-override";

import { fileURLToPath } from "url";
import { dirname } from "path";

// Fix __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();

db();

app.use(methodOverride("_method"));
app.use(nocache());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// custom middlewares
app.use(userContext);
app.use(cartCount);
app.use(wishlistCount);

// passport middleware
app.use(passport.initialize());
app.use(passport.session());

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
]);

app.use("/", userRouter);
app.use("/admin", adminRouter);
app.use("/payment", paymentRouter);

// 404 Forward to error handler
app.use((req, res, next) => {
  const error = new Error("Page Not Found");
  error.status = 404;
  next(error);
});


app.use(errorHandler);

app.listen(process.env.PORT, () => {
  console.log("Server Running");
});

export default app;