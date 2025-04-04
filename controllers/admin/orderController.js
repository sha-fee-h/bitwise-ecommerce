const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema'); 
const Product = require('../../models/productSchema')
const MESSAGES = require('../../constants/messages');
const STATUS_CODES = require('../../constants/statusCodes');
const { v4: uuidv4 } = require("uuid");


const getOrderManagement = async (req, res) => {
    try {
        const { page = 1, search = '', status = '' } = req.query;
        const limit = 10; 
        let query = {};

        if (status) {
            query.deliveryStatus = status;
        }

        
        if (search) {
            
            const users = await User.find({
                $or: [
                    { userName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');

            const userIds = users.map(user => user._id);

            
            query.$or = [
                { orderId: { $regex: search, $options: 'i' } },
                { userId: { $in: userIds } } 
            ];
        }

        
        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        
        const orders = await Order.find(query)
            .populate('userId')
            .populate('products.productId')
            .populate('address')
            .sort({ orderDate: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.render('admin/order-management', {
            orders,
            page: parseInt(page),
            totalPages,
            query: { search, status } 
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('Internal Server Error');
    }
};


const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findOne({ orderId })
            .populate('userId')
            .populate('products.productId')
            .populate('address');
        if (!order) {
            return res.status(STATUS_CODES.NOT_FOUND).send(MESSAGES.NOT_FOUND('Order'));
        }
        res.render('admin/order-details', { order });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('Internal Server Error');
    }
};


const updateOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { deliveryStatus } = req.body;

        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: MESSAGES.NOT_FOUND('Order') });
        }

        if (!['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Return Accepted', 'Return Rejected'].includes(deliveryStatus)) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Invalid status' });
        }

        
        if (order.deliveryStatus === 'Cancelled') {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Cannot change status of cancelled order' });
        }

        
        if (deliveryStatus === 'Cancelled' && order.deliveryStatus !== 'Cancelled') {
            for (const product of order.products) {
                if (product.itemDeliveryStatus !== 'Cancelled') {
                    await Product.updateOne(
                        { _id: product.productId },
                        { $inc: { stock: product.quantity } }
                    );
                }
            }
        } else if (deliveryStatus === 'Returned' && order.deliveryStatus !== 'Returned') {
            
            if (order.deliveryStatus !== 'Delivered') {
                return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Order must be delivered to be marked as returned' });
            }

            
            for (const product of order.products) {
                if (product.itemDeliveryStatus !== 'Cancelled') {
                    await Product.updateOne(
                        { _id: product.productId },
                        { $inc: { stock: product.quantity } }
                    );
                }
            }
        }

        order.deliveryStatus = deliveryStatus;
        await order.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
};



const verifyReturn = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { accepted } = req.body;

        const order = await Order.findOne({ orderId }).populate('userId');
        if (!order || order.deliveryStatus !== 'Returned') {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Invalid return request' });
        }

        if (accepted) {
            
            const wallet = await Wallet.findOne({ userId: order.userId._id }) || new Wallet({ userId: order.userId._id, balance: 0 });
            wallet.balance += order.total; 
            wallet.transactions = wallet.transactions || [];
            const transactionId = uuidv4();
            
            wallet.transactions.push({
                id: transactionId,
                amount: order.total,
                type: 'credit',
                description: `Refund for order #${order.orderId}`,
                date: new Date()
            });
            
            await User.findByIdAndUpdate(
                order.userId._id,
                { $push: { wallet: wallet._id } }
              );
            await wallet.save();


            order.paymentStatus = 'Refunded';
            order.deliveryStatus = 'Return Accepted'; 
        } else {
            
            order.deliveryStatus = 'Return Rejected';
            order.returnReason = null; 
            order.paymentStatus = 'Paid'; 
        }

        await order.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Error verifying return:', error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
};

module.exports = {
    getOrderManagement,
    getOrderDetails,
    updateOrderStatus,
    verifyReturn
};