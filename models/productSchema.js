const mongoose = require("mongoose");
const {Schema} = mongoose;

const productSchema = new Schema({
     productName:{
        type:String,
        required:true
     },
     description:{
        type:String,
        required:true
     },
     category:{
        type:Schema.Types.ObjectId,
        ref:'Category',   //references category model          
        required:true
     },
     productImage:{
        type:[String],
        required:true
     },
     isListed:{
        type:Boolean,
        default:true      //It indicates whether the product is listed or unlisted
     },
     status:{
        type:String,
        enum:['Available','Out_of_stock','Discontinued'],
        required:true,
        default:'Available'
     },
     variants:[
        {
            price:{
                type:Number,
                required:true
            },
            size:{
                type:String,
                required:true
            },
            stock:{
                type:Number,
                required:true
            }
        }
    ]
},{timestamps:true}      //add createdAt and updatedAt automatically
);

const Product = mongoose.model("Product",productSchema);
module.exports = Product;