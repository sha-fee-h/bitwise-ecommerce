const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const couponSchema = new Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
        discount: {
            type: Number,
            required: true,
        },
        expiryDate: {
            type: Date,
            required: true,
        },
        usageLimit: {
            type: Number,
        },
        usedCount: {
            type: Number,
            default: 0,
        },
        minimumSpend: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Coupon", couponSchema);