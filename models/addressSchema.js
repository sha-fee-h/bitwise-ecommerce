const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
    },
    phoneNumber: {
        type: String,
        required: true,
    },
    street: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    state: {
        type: String,
        required: true,
    },
    postalCode: {
        type: String,
        required: true,
    },
    country: {
        type: String,
        required: true,
    },
    additionalInfo: {
        type: String,
        default: "",
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
});

const Address = mongoose.model("Address", addressSchema);
module.exports = Address;