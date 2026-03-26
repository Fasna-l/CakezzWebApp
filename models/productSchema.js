import mongoose from "mongoose";
const { Schema } = mongoose;

const productSchema = new Schema({
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'Category',   //references category model          
        required: true
    },
    productImage: {
        type: [String],
        required: true
    },
    isBlocked: {
        type: Boolean,
        default: false, // Indicates whether the category is active or disabled
    },
    status: {
        type: String,
        enum: ['Available', 'Out_of_stock', 'Discontinued'],
        required: true,
        default: 'Available'
    },
    productOffer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Offer",
        default: null,
    },

    reviews: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            name: { type: String },
            rating: { type: Number, required: true },
            review: { type: String, trim: true },
            date: { type: Date, default: Date.now }
        }
    ],
    variants: [
        {
            price: {
                type: Number,
                required: true
            },
            size: {
                type: String,
                required: true
            },
            stock: {
                type: Number,
                required: true
            }
        }
    ]
}, { timestamps: true }      //add createdAt and updatedAt automatically
);

const Product = mongoose.model("Product", productSchema);
export default Product;