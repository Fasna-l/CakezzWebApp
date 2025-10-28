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

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

//passport middleware setting
app.use(passport.initialize());
app.use(passport.session());

app.set("view engine","ejs");
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')])

app.use("/",userRouter);
app.use("/admin",adminRouter);

app.listen(process.env.PORT, ()=>{
    console.log("Server Running");
})


module.exports = app;