const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, 
    sequence: { type: Number, default: 0 },
    date: { type: Date, default: Date.now }
});

const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;