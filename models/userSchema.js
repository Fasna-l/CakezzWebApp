import mongoose from "mongoose";
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
    profileImage: {
        type: String,
        default: null
    },
    isGoogleUser: {
        type: Boolean,
        default: false
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },

    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
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

export default User;
