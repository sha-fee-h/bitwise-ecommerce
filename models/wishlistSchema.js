const mongoose = require("mongoose");
const { Schema } = mongoose;

const wishlistSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        products: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    },
    {
        timestamps: true,
    }
);

const Wishlist = mongoose.model("Wishlist", wishlistSchema);
module.exports=Wishlist