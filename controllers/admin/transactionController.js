const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');
const MESSAGES = require('../../constants/messages')
const STATUS_CODES = require('../../constants/statusCodes');


const getTransactions = async (req, res) => {
    try {
        
        const page = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 10; 
        const startIndex = (page - 1) * limit;

        
        const wallets = await Wallet.find().populate('userId', 'userName email phone');
        const orders = await Order.find()
            .populate('userId', 'userName email phone')
            .populate('products.productId');

        
        const walletTransactions = [];
        for (const wallet of wallets) {
            wallet.transactions.forEach(transaction => {
                let sourceOrderId = null;
                if (transaction.description.includes('Refund for order #')) {
                    sourceOrderId = transaction.description.match(/#(.+)/)?.[1];
                } else if (transaction.description.includes('cancelled order')) {
                    sourceOrderId = transaction.description.match(/order (\w+)/)?.[1];
                } else if (transaction.description.includes('cancelled item')) {
                    sourceOrderId = transaction.description.match(/order (\w+)/)?.[1];
                }

                walletTransactions.push({
                    transactionId: transaction.id,
                    date: transaction.date,
                    user: wallet.userId,
                    type: transaction.type,
                    amount: transaction.amount,
                    description: transaction.description,
                    source: 'wallet',
                    sourceOrderId
                });
            });
        }

        
        const orderTransactions = orders
            .filter(order => 
                (order.paymentStatus === 'Paid' && ['Razorpay', 'Wallet Payments'].includes(order.paymentMethod)) ||
                (order.paymentMethod === 'Cash on Delivery')
            )
            .map(order => ({
                transactionId: order.paymentId || order._id.toString(),
                date: order.transactionDate || order.orderDate,
                user: order.userId,
                type: order.paymentMethod.toLowerCase().replace(' ', '_'),
                amount: order.total,
                description: `${order.paymentMethod} payment for order #${order.orderId}`,
                source: order.paymentMethod.toLowerCase().replace(' ', '_'),
                sourceOrderId: order.orderId
            }));

        
        const transactions = [...walletTransactions, ...orderTransactions];
        transactions.sort((a, b) => b.date - a.date);

        
        const totalTransactions = transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);
        const paginatedTransactions = transactions.slice(startIndex, startIndex + limit);

        
        res.render('admin/transactions', {
            transactions: paginatedTransactions,
            currentPage: page,
            totalPages,
            limit,
            totalTransactions
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.INTERNAL_SERVER_ERROR);
    }
};

const getTransactionDetails = async (req, res) => {
    try {
        const { transactionId } = req.params;

        let transaction = null;
        let sourceOrder = null;
        let user = null;
        let transactionSource = null;

        // Check wallet transactions by custom 'id' field
        let wallet = await Wallet.findOne({ 'transactions.id': transactionId })
            .populate('userId', 'userName email phone');

        if (wallet) {
            // Find the transaction subdocument by custom 'id'
            transaction = wallet.transactions.find(t => t.id === transactionId);
            user = wallet.userId;
            transactionSource = 'wallet';

            // Extract orderId from description
            let orderId = null;
            if (transaction.description.includes('Refund for order #')) {
                orderId = transaction.description.match(/#(.+)/)?.[1];
            } else if (transaction.description.includes('cancelled order')) {
                orderId = transaction.description.match(/order (\w+)/)?.[1];
            } else if (transaction.description.includes('cancelled item')) {
                orderId = transaction.description.match(/order (\w+)/)?.[1];
            }

            if (orderId) {
                sourceOrder = await Order.findOne({ orderId })
                    .populate('products.productId')
                    .populate('address');
            }
        }

        // Fallback: Check if transactionId is an order paymentId or _id
        if (!transaction) {
            let order = await Order.findOne({ paymentId: transactionId })
                .populate('userId', 'userName email phone')
                .populate('products.productId')
                .populate('address');

            if (!order && mongoose.Types.ObjectId.isValid(transactionId)) {
                order = await Order.findOne({ _id: transactionId })
                    .populate('userId', 'userName email phone')
                    .populate('products.productId')
                    .populate('address');
            }

            if (order) {
                transaction = {
                    _id: order.paymentId || order._id.toString(),
                    date: order.transactionDate || order.orderDate,
                    type: order.paymentMethod.toLowerCase().replace(' ', '_'),
                    amount: order.total,
                    description: `${order.paymentMethod} payment for order #${order.orderId}`
                };
                user = order.userId;
                transactionSource = order.paymentMethod.toLowerCase().replace(' ', '_');
                sourceOrder = order;
            }
        }

        if (!transaction) {
            return res.status(STATUS_CODES.NOT_FOUND).render('404');
        }

        res.render('admin/transaction-details', {
            user,
            transaction,
            sourceOrder,
            transactionSource
        });
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.INTERNAL_SERVER_ERROR);
    }
};


module.exports = { 
    getTransactions,         
    getTransactionDetails    
};