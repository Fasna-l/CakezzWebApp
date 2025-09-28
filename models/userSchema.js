const mongoose = require("mongoose");
const {Schema} = mongoose;


const userSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    googleId:{
        type:String,
        unique:true,
        sparse:true,
        required:false
    },
    password:{
        type:String,
        required:false
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    createdOn:{
        type:String,
        default: () => {
            const now = new Date();
            return now.toISOString().split('T')[0]; //Get the date part only
        },
        required: true,
    }
});

const User = mongoose.model("User",userSchema);

module.exports = User;
