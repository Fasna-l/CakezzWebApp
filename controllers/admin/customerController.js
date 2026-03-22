import User from "../../models/userSchema.js";
import logger from "../../utils/logger.js";
import HTTP_STATUS from "../../utils/httpStatus.js";
import RESPONSE_MESSAGES from "../../utils/responseMessages.js";

const customerInfo = async (req,res,next)=>{
    try {
        let search="";
        if(req.query.search){
            search=req.query.search;
        }
       
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
    }
}

const customerBlocked = async (req,res,next)=>{
    try {
        let id = req.params.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        
        logger.warn(
            `ADMIN CUSTOMER BLOCKED | CustomerId: ${id}`
        );
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: RESPONSE_MESSAGES.CUSTOMER_BLOCKED
        });
    } catch (error) {
        next(error);
    }
}

const customerUnBlocked = async (req,res,next)=>{
    try {
        let id = req.params.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        logger.info(
            `ADMIN CUSTOMER UNBLOCKED | CustomerId: ${id}`
        );
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: RESPONSE_MESSAGES.CUSTOMER_UNBLOCKED
        });
    } catch (error) {
        next(error);
    }
}

export default {
  customerInfo,
  customerBlocked,
  customerUnBlocked,
};