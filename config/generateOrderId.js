
const Counter = require('../models/counter');

const generateOrderId = async () => {
    const now = new Date();

    const prefix = 'OD';
    const year = now.getFullYear().toString().slice(-2); // e.g., "25" for 2025
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // e.g., "03" for March
    const day = now.getDate().toString().padStart(2, '0'); // e.g., "21" for 21st
    const datePart = `${year}${month}${day}`; // e.g., "250321" for 2025-03-21

    const dateString = now.toISOString().split('T')[0]; // e.g., "2025-03-21"
    const counterName = `order-${dateString}`;

    // Atomically increment the counter for the given day
    const counter = await Counter.findOneAndUpdate(
        { name: counterName },
        {
            $inc: { sequence: 1 },
            $setOnInsert: { date: now },
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        }
    );

    const sequencePart = counter.sequence.toString().padStart(6, '0'); // e.g., "000007"
    const orderId = `${prefix}${datePart}${sequencePart}`; // e.g., "OD250321000007"

    return orderId;
};

module.exports = generateOrderId;