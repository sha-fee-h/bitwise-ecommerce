const mongoose = require("mongoose");

const categorySchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim:true,
            lowercase:true
        },
        description: {
            type: String,
        },
        status: {
            type: String,
            enum: ["listed", "unlisted"],
            default: "listed",
        },
        image: {
            type: [String],
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);