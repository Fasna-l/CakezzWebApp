const User = require("../../models/userSchema")



const customerInfo = async (req,res)=>{
    try {
        //search button
        let search="";
        if(req.query.search){
            search=req.query.search;
        }
        //paginatiion
        let page=1;
        if(req.query.page){
            page=parseInt(req.query.page)
        }
        const limit=3
        const userData = await User.find({
            isAdmin:false,
            $or:[

                {name: { $regex: search, $options: 'i' }},
                {email: { $regex: search, $options: 'i' }}
            ]
        })
        .sort({_id: -1})
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec();//combine chain of promise

        //calculate total pages
        const count = await User.find({
            isAdmin:false,
            $or:[

                {name: { $regex: search, $options: 'i' }},
                {email: { $regex: search, $options: 'i' }}
            ]
        }).countDocuments();

        const totalPages = Math.ceil(count/limit);
        
        res.render("customers",{
            data:userData,
            currentPage: page,
            totalPages,
            search
        });
    } catch (error) {
        console.error(error);
        res.redirect("/pageerror")
    }
}

const customerBlocked = async (req,res)=>{
    try {
        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/users")

    } catch (error) {
        res.redirect("/pageerror")
    }
}

const customerUnBlocked = async (req,res)=>{
    try {
        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/users")
    } catch (error) {
        res.redirect("/pageerror")
    }
}

module.exports = {
    customerInfo,
    customerBlocked,
    customerUnBlocked
}