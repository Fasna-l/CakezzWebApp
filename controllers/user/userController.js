


const pageNotFound = async (req,res)=>{
    try {
        res.render("user/pageNotFound")
    } catch (error) {
        res.redirect("user/pageNotFound")
    }
}



//Load Home Page
const loadHomepage = async (req,res)=>{
    try {
        
        return res.render("user/home");

    } catch (error) {
        console.log("Home page not found");
        res.status(500).send("server error")
    }
}

module.exports = {
    loadHomepage,
    pageNotFound
}