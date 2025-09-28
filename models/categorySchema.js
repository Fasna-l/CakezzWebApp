const mongoose = require("mongoose");
const {Schema} = mongoose;

const categorySchema = new Schema({
    categoryName:{
        type:String,
        required:true,
        unique:true,
    },
    description:{
        type:String,
        required:true
    },
    isListed:{
        type:Boolean,
        default:true
    },
    categoryOffer:{
        name:{
            type:String,
            required:false
        },
        discount:{
            type:Number,
            required:false
        },
        startDate:{
            type:Date,
            required:false
        },
        endDate:{
            type:Date,
            required:false
        }
    }
},{timestamps:true}
);

const Category = mongoose.model("Category",categorySchema);

module.exports = Category;