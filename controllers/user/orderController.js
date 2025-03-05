const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const Wallet = require('../../models/walletSchema')


const getOrderHistory = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const user = await User.findById(userId)
        // console.log('user in orderhistory page',user)
        const orders = await Order.find({ userId })
            .populate('products.productId')
            .populate('address')
            .sort({ orderDate: -1 });
        res.render('user/order-history', { orders ,user , page:'orders'});
    } catch (error) {
        console.error('Error fetching order history:', error);
        res.status(500).send('Internal Server Error');
    }
};


const getOrderDetails = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const user = await User.findById(userId)
        const orderId = req.params.orderId;
        const order = await Order.findOne({ orderId })
            .populate('products.productId')
            .populate('address');
        // console.log('order is populated as', order.products[0].productId.images[0])
        if (!order) {
            return res.status(404).send('Order not found');
        }
        res.render('user/order-details', { order, user });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Internal Server Error');
    }
};



const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { cancellationReason } = req.body;
        const order = await Order.findOne({ orderId }).populate('products.productId');

        if (!order || ['Cancelled', 'Delivered', 'Returned'].includes(order.deliveryStatus)) {
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled' });
        }

        
        for (const product of order.products) {
            await Product.updateOne(
                { _id: product.productId._id },
                { $inc: { stock: product.quantity } }
            );
        }

        
        if (order.paymentStatus === 'Paid') {
            const userId = order.userId;
            const refundAmount = order.total; 

            let wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                wallet = new Wallet({ userId, balance: 0, transactions: [] });
            }

            wallet.balance += refundAmount;
            wallet.transactions.push({
                type: 'credit',
                amount: refundAmount,
                description: `Refund for cancelled order ${orderId}`
            });

            await wallet.save();
            console.log(`Refunded ₹${refundAmount} to wallet for order ${orderId}`);
        }

        order.deliveryStatus = 'Cancelled';
        order.cancellationReason = cancellationReason;
        await order.save();

        res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};


const cancelItem = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        const { cancellationReason } = req.body;
        const order = await Order.findOne({ orderId }).populate('products.productId');

        if (!order || ['Cancelled', 'Delivered', 'Returned'].includes(order.deliveryStatus)) {
            return res.status(400).json({ success: false, message: 'Cannot cancel item' });
        }

        const productIndex = order.products.findIndex(p => p.productId._id.toString() === productId);
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in order' });
        }

        const product = order.products[productIndex];
        if (product.itemDeliveryStatus === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Item already cancelled' });
        }

        
        let refundAmount = 0;
        if (order.paymentStatus === 'Paid') {
            
            const itemSubtotal = product.price * product.quantity;
            const totalItems = order.products.reduce((acc, p) => acc + p.quantity, 0);
            const itemProportion = (itemSubtotal - (product.offerDiscount || 0)) / (order.total + (order.couponDiscount || 0) + order.offerDiscount - order.shippingCost);
            refundAmount = (order.total - order.shippingCost) * itemProportion + (order.shippingCost && totalItems === 1 ? order.shippingCost : 0);

            let wallet = await Wallet.findOne({ userId: order.userId });
            if (!wallet) {
                wallet = new Wallet({ userId: order.userId, balance: 0, transactions: [] });
            }

            wallet.balance += refundAmount;
            wallet.transactions.push({
                type: 'credit',
                amount: refundAmount,
                description: `Refund for cancelled item ${productId} in order ${orderId}`
            });

            await wallet.save();
            console.log(`Refunded ₹${refundAmount.toFixed(2)} to wallet for item ${productId} in order ${orderId}`);
        }

        // Increment stock
        await Product.updateOne(
            { _id: product.productId._id },
            { $inc: { stock: product.quantity } }
        );

        product.itemDeliveryStatus = 'Cancelled';
        product.itemCancelledAt = new Date();
        product.itemCancellationReason = cancellationReason;

        await order.save();

        res.json({ success: true, message: 'Item cancelled successfully', refundAmount: refundAmount.toFixed(2) });
    } catch (error) {
        console.error('Error cancelling item:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};




const returnOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { returnReason } = req.body;
        const order = await Order.findOne({ orderId }).populate('products.productId');

        if (!order || order.deliveryStatus !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Order cannot be returned' });
        }

        
        for (const product of order.products) {
            if (product.itemDeliveryStatus !== 'Cancelled') {
                await Product.updateOne(
                    { _id: product.productId._id },
                    { $inc: { stock: product.quantity } }
                );
            }
        }

        order.deliveryStatus = 'Returned';
        order.returnReason = returnReason;
        await order.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error returning order:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Download invoice
const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findOne({ orderId })
            .populate('products.productId')
            .populate('address');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const doc = new PDFDocument();
        const filename = `invoice-${order.orderId}.pdf`;
        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        // PDF content
        doc.fontSize(20).text(`Invoice - Order #${order.orderId}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Order Date: ${order.orderDate.toLocaleDateString()}`);
        doc.text(`Delivery Status: ${order.deliveryStatus}`);
        doc.text(`Payment Method: ${order.paymentMethod}`);
        doc.text(`Payment Status: ${order.paymentStatus}`);
        doc.moveDown();

        doc.text('Items:', { underline: true });
        order.products.forEach(product => {
            doc.text(`${product.productId.name} - Qty: ${product.quantity} @ $${product.price.toFixed(2)}`);
        });

        doc.moveDown();
        doc.text('Shipping Address:', { underline: true });
        doc.text(`${order.address.firstName} ${order.address.lastName}`);
        doc.text(`${order.address.street}, ${order.address.city}, ${order.address.state} ${order.address.postalCode}`);
        doc.text(order.address.country);

        doc.moveDown();
        doc.text(`Subtotal: $${(order.total - order.shippingCost + order.couponDiscount + order.offerDiscount).toFixed(2)}`);
        if (order.couponDiscount > 0) doc.text(`Coupon Discount: -$${order.couponDiscount.toFixed(2)}`);
        if (order.offerDiscount > 0) doc.text(`Offer Discount: -$${order.offerDiscount.toFixed(2)}`);
        doc.text(`Shipping: $${order.shippingCost.toFixed(2)}`);
        doc.text(`Total: $${order.total.toFixed(2)}`, { bold: true });

        doc.end();
    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = {
    getOrderHistory,
    getOrderDetails,
    cancelOrder,
    cancelItem,
    returnOrder,
    downloadInvoice
};