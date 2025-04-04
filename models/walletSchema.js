const mongoose = require('mongoose');
const { Schema } = mongoose;

const walletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0
    },
    transactions: [{
        id: {type:String},
        amount: Number,
        type: { type: String, enum: ['credit', 'debit'] },
        description: String,
        date: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('Wallet', walletSchema);