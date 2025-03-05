const mongoose = require('mongoose')
const { Schema } = mongoose;
const userSchema = new Schema({
    userName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: false,
        unique: false,
        sparse: true,
        default: null
    },
    googleId: {
        type: String,
        unique: false,
        sparse:true
    },
    password: {
        type: String,
        required: false,
    },
    isBlocked: {
        type: Boolean,
        default:false
    },
    isAdmin: {
        type: Boolean,
        default: false,
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart"
    }],
    wallet: [{
        type: Schema.Types.ObjectId,
        ref: "Wallet"
    }],
    referralCode: {
        type: String
    },
    redeemed: {
        type: Boolean
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
        },
        brand: {
            type: String
        },
        searchOn: {
            type: Date,
            default: Date.now
        }
    }],
    profileImage:{
        type:String
    },
    addresses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Address" }],
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }]
}, { timestamps: true })

const User = mongoose.model("User", userSchema);
module.exports = User