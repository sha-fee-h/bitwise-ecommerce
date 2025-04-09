const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const Wallet = require('../../models/walletSchema')
const { v4: uuidv4 } = require("uuid");



const getOrderHistory = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const user = await User.findById(userId);

        
        const { page = 1, startDate, endDate } = req.query;
        const perPage = 6; // 5 orders per page
        const currentPage = parseInt(page) || 1;
        const skip = (currentPage - 1) * perPage;

        
        let filter = { userId };

        
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); 
            filter.orderDate = { $gte: start, $lte: end };
        } else if (startDate) {
            const start = new Date(startDate);
            filter.orderDate = { $gte: start };
        } else if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); 
            filter.orderDate = { $lte: end };
        }

        
        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / perPage);

        
        const orders = await Order.find(filter)
            .populate('products.productId', 'name images') 
            .populate('address')
            .sort({ orderDate: -1 })
            .skip(skip)
            .limit(perPage);

        res.render('user/order-history', {
            orders,
            user,
            page: 'orders',
            currentPage,
            totalPages,
            perPage,
            totalOrders,
            startDate,
            endDate,
            cartCount:0,
            wishlistCount:0
        });
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
        res.render('user/order-details', { order, user ,cartCount:0, wishlistCount:0});
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
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        
        if (['Delivered', 'Returned'].includes(order.deliveryStatus)) {
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled as it is already delivered or returned' });
        }

        
        const allItemsCancelled = order.products.every(product => product.itemDeliveryStatus === 'Cancelled');
        if (allItemsCancelled) {
            
            if (order.deliveryStatus !== 'Cancelled') {
                order.deliveryStatus = 'Cancelled';
                order.cancellationReason = cancellationReason || order.cancellationReason || 'All items cancelled';
                await order.save();
            }
            return res.status(400).json({ success: false, message: 'Order is already fully cancelled' });
        }

        
        let refundAmount = 0;
        const itemsToCancel = [];

        
        for (const product of order.products) {
            
            if (product.itemDeliveryStatus === 'Cancelled') {
                continue;
            }

            
            itemsToCancel.push(product);

            
            const itemPrice = (product.price * product.quantity) - (product.offerDiscount ? product.offerDiscount * product.quantity : 0);
            refundAmount += itemPrice;

            
            await Product.updateOne(
                { _id: product.productId._id },
                { $inc: { stock: product.quantity } }
            );

            
            product.itemDeliveryStatus = 'Cancelled';
            product.itemCancelledAt = new Date();
        }

        
        if (itemsToCancel.length === 0) {
            return res.status(400).json({ success: false, message: 'No items are eligible for cancellation' });
        }

        
        if (order.paymentStatus === 'Paid' && refundAmount > 0) {
            const userId = order.userId;

            
            let wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                wallet = new Wallet({ userId, balance: 0, transactions: [] });
            }

        const transactionId = uuidv4();
            wallet.balance += refundAmount;
            wallet.transactions.push({
                id : transactionId,
                type: 'credit',
                amount: refundAmount,
                description: `Refund for cancelled items in order ${orderId}`
            });

            await wallet.save();
            console.log(`Refunded ₹${refundAmount} to wallet for order ${orderId}`);
        }

        
        order.deliveryStatus = 'Cancelled';
        order.cancellationReason = cancellationReason || 'Order cancelled by user';
        await order.save();

        res.json({ success: true, message: 'Order cancelled successfully', refundAmount });
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
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        
        if (['Cancelled', 'Delivered', 'Returned'].includes(order.deliveryStatus)) {
            return res.status(400).json({ success: false, message: 'Cannot cancel item as the order is already cancelled, delivered, or returned' });
        }

        
        const productIndex = order.products.findIndex(p => p.productId._id.toString() === productId);
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in order' });
        }

        const product = order.products[productIndex];

        
        if (product.itemDeliveryStatus === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Item already cancelled' });
        }

        
        const itemFinalPrice = (product.price * product.quantity) - (product.offerDiscount ? product.offerDiscount * product.quantity : 0);
        let refundAmount = itemFinalPrice;

        
        if (order.paymentStatus === 'Paid' && refundAmount > 0) {
            const userId = order.userId;

            
            let wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                wallet = new Wallet({ userId, balance: 0, transactions: [] });
            }

            const transactionId = uuidv4();
            
            wallet.balance += refundAmount;
            wallet.transactions.push({
                id: transactionId,
                type: 'credit',
                amount: refundAmount,
                description: `Refund for cancelled item ${product.productId.name} in order ${orderId}`
            });

            await wallet.save();
            console.log(`Refunded ₹${refundAmount.toFixed(2)} to wallet for item ${productId} in order ${orderId}`);
        }

        
        await Product.updateOne(
            { _id: product.productId._id },
            { $inc: { stock: product.quantity } }
        );

        
        product.itemDeliveryStatus = 'Cancelled';
        product.itemCancelledAt = new Date();
        product.itemCancellationReason = cancellationReason || 'Item cancelled by user';

        
        const allItemsCancelled = order.products.every(p => p.itemDeliveryStatus === 'Cancelled');
        if (allItemsCancelled) {
            order.deliveryStatus = 'Cancelled';
            order.cancellationReason = cancellationReason || 'All items cancelled';
        }

        await order.save();

        res.json({
            success: true,
            message: 'Item cancelled successfully',
            refundAmount: refundAmount.toFixed(2)
        });
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

const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findOne({ orderId })
            .populate('products.productId')
            .populate('address')
            .populate('userId');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Create a new PDF document
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            info: {
                Title: `Invoice - Order #${order.orderId}`,
                Author: 'Bitwise',
            },
        });

        // Set response headers for PDF download
        const filename = `invoice-${order.orderId}.pdf`;
        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        // Pipe the PDF to the response
        doc.pipe(res);

        // Define colors for consistent branding
        const colors = {
            primary: '#3366CC',      // Company brand color
            secondary: '#F5F5F5',    // Light background for sections
            text: '#333333',         // Main text color
            lightText: '#777777',    // Secondary text color
            highlight: '#E6F0FF',    // Highlight background
            border: '#CCCCCC',       // Border color
        };

        // Helper function to add a horizontal line
        const addHorizontalLine = (thickness = 0.5, color = colors.border) => {
            doc.moveDown(0.5);
            doc.lineWidth(thickness)
                .moveTo(50, doc.y)
                .lineTo(550, doc.y)
                .strokeColor(color)
                .stroke();
            doc.moveDown(0.5);
        };

        // Helper function to add a section with background
        const addSection = (callback) => {
            const startY = doc.y;
            doc.rect(40, startY, 520, 0).fill(colors.secondary); // Initial height of 0
            
            // Save position and move slightly down for content
            const contentStartY = startY + 10;
            doc.y = contentStartY;
            
            // Execute callback to add content
            callback();
            
            // Add padding at the bottom
            doc.moveDown(0.5);
            
            // Now draw the rectangle with the actual height
            const endY = doc.y;
            doc.rect(40, startY, 520, endY - startY + 10)
                .fillAndStroke(colors.secondary, colors.border);
            
            // Reset position to end of section
            doc.y = endY + 15;
        };

        // --- Header Section ---
        // Add logo placeholder with brand color box
        doc.rect(50, 40, 100, 50)
            .fillColor(colors.primary)
            .fill();
        doc.fillColor('white')
            .fontSize(22)
            .font('Helvetica-Bold')
            .text('BITWISE', 60, 55);

        // Company Details
        doc.fillColor(colors.text)
            .fontSize(10)
            .font('Helvetica')
            .text('123 Business Street, Mumbai, Maharashtra 400001, India', 50, 95)
            .text('Email: support@bitwise.com | Phone: +91 9876543210', 50, 110);

        // Invoice Title and Details
        doc.fontSize(20)
            .font('Helvetica-Bold')
            .fillColor(colors.primary)
            .text(`INVOICE #${order.orderId}`, 0, 50, { align: 'right' });
        
        doc.fontSize(11)
            .font('Helvetica')
            .fillColor(colors.text)
            .text(`Invoice Date: ${new Date().toLocaleDateString()}`, 0, 75, { align: 'right' })
            .text(`Order Date: ${order.orderDate.toLocaleDateString()}`, 0, 90, { align: 'right' });

        doc.moveDown(3);
        addHorizontalLine(1, colors.primary); // Thicker line in brand color

        // --- Customer and Shipping Details in a section with background ---
        addSection(() => {
            const startY = doc.y;
            
            // Customer Details Column
            doc.fontSize(12)
                .font('Helvetica-Bold')
                .fillColor(colors.primary)
                .text('BILLED TO:', 60, startY);
            
            doc.fontSize(11)
                .font('Helvetica')
                .fillColor(colors.text)
                .moveDown(0.5)
                .text(`${order.userId?.userName || 'Customer'}`)
                .moveDown(0.2)
                .text(`${order.userId?.email || 'N/A'}`);

            // Shipping Address Column
            doc.fontSize(12)
                .font('Helvetica-Bold')
                .fillColor(colors.primary)
                .text('SHIPPING ADDRESS:', 300, startY);
            
            doc.fontSize(11)
                .font('Helvetica')
                .fillColor(colors.text)
                .moveDown(0.5)
                .text(`${order.address.firstName} ${order.address.lastName}`, 300)
                .moveDown(0.2)
                .text(`${order.address.street}`, 300)
                .moveDown(0.2)
                .text(`${order.address.city}, ${order.address.state} ${order.address.postalCode}`, 300)
                .moveDown(0.2)
                .text(`${order.address.country}`, 300);
        });

        // --- Order Status Details ---
        doc.moveDown(0.5);
        
        // Create a status bar
        const statuses = ['Ordered', 'Processing', 'Shipped', 'Delivered'];
        const currentStatusIndex = statuses.indexOf(order.deliveryStatus) || 0;
        
        const statusBarWidth = 450;
        const segmentWidth = statusBarWidth / (statuses.length - 1);
        const startX = 75;
        const statusY = doc.y + 15;
        
        // Draw the status bar
        doc.lineWidth(3)
            .strokeColor(colors.lightText)
            .moveTo(startX, statusY)
            .lineTo(startX + statusBarWidth, statusY)
            .stroke();
        
        // Draw completed segments with primary color
        if (currentStatusIndex > 0) {
            doc.lineWidth(3)
                .strokeColor(colors.primary)
                .moveTo(startX, statusY)
                .lineTo(startX + (currentStatusIndex * segmentWidth), statusY)
                .stroke();
        }
        
        // Draw status points and labels
        statuses.forEach((status, index) => {
            const x = startX + (index * segmentWidth);
            const isActive = index <= currentStatusIndex;
            
            // Draw point
            doc.circle(x, statusY, 6)
                .fillAndStroke(
                    isActive ? colors.primary : colors.secondary, 
                    isActive ? colors.primary : colors.lightText
                );
            
            // Draw label
            doc.fontSize(8)
                .font(isActive ? 'Helvetica-Bold' : 'Helvetica')
                .fillColor(isActive ? colors.primary : colors.lightText)
                .text(status, x - 20, statusY + 10, { width: 40, align: 'center' });
        });
        
        doc.moveDown(3);

        // Payment details
        doc.fontSize(11)
            .font('Helvetica')
            .fillColor(colors.text)
            .text(`Payment Method: ${order.paymentMethod}`, 50, doc.y)
            .moveDown(0.5)
            .text(`Payment Status: `, 50);
        
        // Add colored payment status
        const paymentStatusColor = order.paymentStatus === 'Paid' ? '#008800' : '#CC0000';
        doc.fillColor(paymentStatusColor)
            .font('Helvetica-Bold')
            .text(order.paymentStatus, doc.x, doc.y - 14);

        doc.moveDown(2);

        // --- Items Table with improved styling ---
        doc.fontSize(14)
            .font('Helvetica-Bold')
            .fillColor(colors.primary)
            .text('ORDER ITEMS', 50, doc.y);
        
        // Table Header
        const tableTop = doc.y + 15;
        const tableLayout = {
            product: { x: 50, width: 200 },
            qty: { x: 250, width: 40, align: 'center' },
            price: { x: 300, width: 70, align: 'right' },
            discount: { x: 380, width: 70, align: 'right' },
            total: { x: 460, width: 80, align: 'right' }
        };

        // Table header background
        doc.rect(40, tableTop - 5, 520, 25)
            .fillColor(colors.primary)
            .fill();
        
        // Table Header Text
        doc.fontSize(10)
            .font('Helvetica-Bold')
            .fillColor('white')
            .text('PRODUCT', tableLayout.product.x, tableTop)
            .text('QTY', tableLayout.qty.x, tableTop, { width: tableLayout.qty.width, align: 'center' })
            .text('PRICE', tableLayout.price.x, tableTop, { width: tableLayout.price.width, align: 'right' })
            .text('DISCOUNT', tableLayout.discount.x, tableTop, { width: tableLayout.discount.width, align: 'right' })
            .text('TOTAL', tableLayout.total.x, tableTop, { width: tableLayout.total.width, align: 'right' });

        // Table Rows
        let yPosition = tableTop + 30;
        let rowColor = true; // For alternating row colors
        
        order.products.forEach((product, index) => {
            const actualPrice = (product.price * product.quantity).toFixed(2);
            const discount = (product.offerDiscount ? product.offerDiscount * product.quantity : 0).toFixed(2);
            const finalPrice = (actualPrice - discount).toFixed(2);

            // Add alternating row background
            if (rowColor) {
                doc.rect(40, yPosition - 5, 520, 25)
                    .fillColor(colors.highlight)
                    .fill();
            }
            rowColor = !rowColor;

            // Add row content
            doc.fontSize(10)
                .font('Helvetica')
                .fillColor(colors.text)
                .text(product.productId.name, tableLayout.product.x, yPosition, 
                      { width: tableLayout.product.width, ellipsis: true })
                .text(product.quantity.toString(), tableLayout.qty.x, yPosition, 
                      { width: tableLayout.qty.width, align: 'center' })
                .text(`₹${product.price.toFixed(2)}`, tableLayout.price.x, yPosition, 
                      { width: tableLayout.price.width, align: 'right' });
            
            // Show discount with color if applicable
            if (discount > 0) {
                doc.fillColor('#CC0000')
                    .text(`-₹${discount}`, tableLayout.discount.x, yPosition, 
                          { width: tableLayout.discount.width, align: 'right' });
            } else {
                doc.fillColor(colors.text)
                    .text(`₹0.00`, tableLayout.discount.x, yPosition, 
                          { width: tableLayout.discount.width, align: 'right' });
            }
            
            // Show final price
            doc.fillColor(colors.text)
                .text(`₹${finalPrice}`, tableLayout.total.x, yPosition, 
                      { width: tableLayout.total.width, align: 'right' });

            yPosition += 25;

            // Check if we need a new page
            if (yPosition > 650) {
                doc.addPage();
                doc.fontSize(10).text("(continued)", 50, 40);
                yPosition = 60;
                
                // Repeat header on new page
                doc.rect(40, yPosition - 5, 520, 25)
                    .fillColor(colors.primary)
                    .fill();
                
                doc.fontSize(10)
                    .font('Helvetica-Bold')
                    .fillColor('white')
                    .text('PRODUCT', tableLayout.product.x, yPosition)
                    .text('QTY', tableLayout.qty.x, yPosition, { width: tableLayout.qty.width, align: 'center' })
                    .text('PRICE', tableLayout.price.x, yPosition, { width: tableLayout.price.width, align: 'right' })
                    .text('DISCOUNT', tableLayout.discount.x, yPosition, { width: tableLayout.discount.width, align: 'right' })
                    .text('TOTAL', tableLayout.total.x, yPosition, { width: tableLayout.total.width, align: 'right' });
                
                yPosition += 30;
                rowColor = true;
            }
        });

        // Add bottom border for the table
        doc.lineWidth(1)
            .moveTo(40, yPosition)
            .lineTo(560, yPosition)
            .strokeColor(colors.border)
            .stroke();

        yPosition += 20;

        // --- Price Breakdown in a highlighted box ---
        doc.rect(290, yPosition, 270, 130)
            .fillColor(colors.highlight)
            .strokeColor(colors.border)
            .fillAndStroke();

        yPosition += 15;
        
        doc.fontSize(14)
            .font('Helvetica-Bold')
            .fillColor(colors.primary)
            .text('PRICE SUMMARY', 300, yPosition);
        
        yPosition += 25;

        // Subtotal
        const subtotal = order.products.reduce((acc, product) => acc + (product.price * product.quantity), 0).toFixed(2);
        doc.fontSize(10)
            .font('Helvetica')
            .fillColor(colors.text)
            .text('Subtotal:', 300, yPosition)
            .font('Helvetica-Bold')
            .text(`₹${subtotal}`, 0, yPosition, { align: 'right', width: 540 });
        
        yPosition += 20;

        // Discounts
        let totalDiscount = 0;
        
        if (order.offerDiscount > 0) {
            totalDiscount += order.offerDiscount;
            doc.fontSize(10)
                .font('Helvetica')
                .fillColor(colors.text)
                .text('Offer Discount:', 300, yPosition)
                .fillColor('#CC0000')
                .font('Helvetica-Bold')
                .text(`-₹${order.offerDiscount.toFixed(2)}`, 0, yPosition, { align: 'right', width: 540 });
            
            yPosition += 20;
        }

        if (order.couponDiscount > 0) {
            totalDiscount += order.couponDiscount;
            doc.fontSize(10)
                .font('Helvetica')
                .fillColor(colors.text)
                .text('Coupon Discount:', 300, yPosition)
                .fillColor('#CC0000')
                .font('Helvetica-Bold')
                .text(`-₹${order.couponDiscount.toFixed(2)}`, 0, yPosition, { align: 'right', width: 540 });
            
            yPosition += 20;
        }

        // Shipping cost
        doc.fontSize(10)
            .font('Helvetica')
            .fillColor(colors.text)
            .text('Shipping Cost:', 300, yPosition)
            .font('Helvetica-Bold')
            .text(`₹${order.shippingCost.toFixed(2)}`, 0, yPosition, { align: 'right', width: 540 });
        
        yPosition += 25;

        // Total with highlight
        doc.rect(290, yPosition - 5, 270, 25)
            .fillColor(colors.primary)
            .fill();
        
        doc.fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('white')
            .text('TOTAL:', 300, yPosition)
            .text(`₹${order.total.toFixed(2)}`, 0, yPosition, { align: 'right', width: 540 });

        // Add savings info if there were discounts
        if (totalDiscount > 0) {
            yPosition += 40;
            doc.fontSize(11)
                .font('Helvetica-Bold')
                .fillColor('#008800')
                .text(`You Saved: ₹${totalDiscount.toFixed(2)}`, 400, yPosition, { align: 'right' });
        }

        // --- Footer with brand color bar ---
        doc.rect(40, 730, 520, 5)
            .fillColor(colors.primary)
            .fill();
        
        doc.fontSize(10)
            .font('Helvetica')
            .fillColor(colors.text)
            .text('Thank you for shopping with Bitwise!', 0, 745, { align: 'center' })
            .fontSize(9)
            .fillColor(colors.lightText)
            .text('For any queries, contact us at support@bitwise.com', 0, 760, { align: 'center' })
            .text(`Generated on ${new Date().toLocaleString()}`, 0, 775, { align: 'center' });

        // Finalize the PDF
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