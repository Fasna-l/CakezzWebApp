


const pageNotFound = async (req,res)=>{
    try {
        res.render("pageNotFound")
    } catch (error) {
        res.redirect("pageNotFound")
    }
}



//Load Home Page

const loadHomepage = async (req,res)=>{
    try {
        
        return res.render("home");

    } catch (error) {
        console.log("Home page not found");
        res.status(500).send("server error")
    }
}

//Load Login

const loadLogin = async (req,res)=>{
    try {
        return res.render("login")
    } catch (error) {
        console.log("Login page is not loading",error);
        res.status(500).send("Server Error");
    }
}
//Load Signup page

const loadSignup = async (req,res)=>{
    try {
        return res.render("signup")
    } catch (error) {
        console.log("Signup page is not loading",error);
        res.status(500).send("Server Error")
    }
}

//Load Shop Page

const loadShoppage = async (req,res)=>{
    try {
        return res.render("shop")
    } catch (error) {
        
        console.log("Shopping page not loading",error);
        res.status(500).send("Server Error")
    }
}

module.exports = {
    loadHomepage,
    pageNotFound,
    loadShoppage,
    loadSignup,
    loadLogin
}