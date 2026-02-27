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
    categoryOffer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CategoryOffer",
        default: null,
    }
},{timestamps:true}
);

const Category = mongoose.model("Category",categorySchema);

module.exports = Category;