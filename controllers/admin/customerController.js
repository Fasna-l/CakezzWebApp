const User = require("../../models/userSchema")



const customerInfo = async (req,res,next)=>{
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
        const limit=4;
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
        next(error);
        // console.error(error);
        // res.redirect("/pageerror")
    }
}

const customerBlocked = async (req,res,next)=>{
    try {
        //let id = req.query.id;
        let id = req.params.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        //res.redirect("/admin/users")
        return res.status(200).json({ success: true });
    } catch (error) {
        next(error);
        // console.error(error);
        // return res.status(500).json({ success: false });
        //res.redirect("/pageerror")
    }
}

const customerUnBlocked = async (req,res,next)=>{
    try {
        //let id = req.query.id;
        let id = req.params.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        //res.redirect("/admin/users")
        return res.status(200).json({ success: true });
    } catch (error) {
        next(error);
        // console.error(error);
        // return res.status(500).json({ success: false });
        //res.redirect("/pageerror")
    }
}

module.exports = {
    customerInfo,
    customerBlocked,
    customerUnBlocked
}