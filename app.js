const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv").config();
const db = require("./config/db");
const session = require("express-session");
const passport = require("./config/passport")
const nocache = require('nocache');
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const errorHandler = require("./middlewares/errorHandler");
//const User = require("./models/userSchema");
//const Cart = require("./models/cartSchema");
const userContext = require("./middlewares/userContext");
const cartCount = require("./middlewares/cartCount");
db()

app.use(nocache());
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:1000*60*60*24
    }
}))

// app.use((req, res, next) => {
//   res.locals.user = req.session.user || null;
//   next();
// });
// app.use(async (req, res, next) => {
//   if (req.session.user) {
//     res.locals.user = await User.findById(req.session.user).lean();
//   } else {
//     res.locals.user = null;
//   }
//   next();
// });

// app.use(async (req, res, next) => {
//   if (!req.session.user) {
//     res.locals.cartCount = 0;
//     return next();
//   }

//   const cart = await Cart.findOne({ user: req.session.user });
//   res.locals.cartCount = cart ? cart.items.length : 0;

//   next();
// });

//custom middlewares from middleware folder
app.use(userContext);
app.use(cartCount);

//passport middleware setting
app.use(passport.initialize());
app.use(passport.session());

app.set("view engine","ejs");
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')])

app.use("/",userRouter);
app.use("/admin",adminRouter);
app.use(errorHandler);
app.listen(process.env.PORT, ()=>{
    console.log("Server Running");
})


module.exports = app;