const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
    {
        orderId: {
            type: String,
            default:()=>uuidv4(),
            required: true,
            unique: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        products: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                },
                price: {
                    type: Number,
                    required: true,
                },
                offerDiscount: { type: Number, default: 0 },
                itemDeliveryStatus: {
                    type: String,
                    enum: ["Cancelled"],
                },
                itemCancelledAt: {
                    type: Date,
                },
                itemCancellationReason: {
                    type: String,
                }
            },
        ],
        orderDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        deliveryStatus: {
            type: String,
            required: true,
            enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"],
            default: "Pending",
        },
        paymentMethod: {
            type: String,
            required: true,
            enum: ["Razorpay", "Wallet Payments", "Cash on Delivery"],
        },
        paymentStatus: {
            type: String,
            required: true,
            enum: ["Pending", "Paid", "Failed", "Refunded"],
            default: "Pending",
        },
        total: {
            type: Number,
            required: true,
        },
        orderTime: {
            type: Date,
            required: true,
            default: Date.now,
        },
        shippingCost: {
            type: Number,
            default: 0,
        },
        address: {
            type:mongoose.Schema.Types.ObjectId,
            required:true,
            ref:'Address'
        },
        cancellationReason: {
            type: String,
        },
        returnReason: {
            type: String,
        },
        couponCode: {
            type: String,
            default: null,
        },
        couponDiscount: {
            type: Number,
            default: 0,
        },
        offerDiscount: {
            type: Number,
            default: 0,
        },
        paymentId: {
            type: String,
            default: null,
        },
        razorpayOrderId: {
            type: String,
            default: null,
        },
        transactionDate: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;