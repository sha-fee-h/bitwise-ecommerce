const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const getSalesReport = async (req, res) => {
    try {
        const { filterType, startDate, endDate } = req.query;

        
        let start, end;
        const now = new Date();
        switch (filterType) {
            case 'daily':
                start = new Date(now.setHours(0, 0, 0, 0));
                end = new Date(now.setHours(23, 59, 59, 999));
                break;
            case 'weekly':
                start = new Date(now.setDate(now.getDate() - now.getDay())); // Start of week (Sunday)
                start.setHours(0, 0, 0, 0);
                end = new Date(now.setDate(start.getDate() + 6)); // End of week (Saturday)
                end.setHours(23, 59, 59, 999);
                break;
            case 'monthly':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'yearly':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
                end.setHours(23, 59, 59, 999);
                break;
            case 'custom':
                if (!startDate || !endDate) {
                    return res.status(400).json({ success: false, message: 'Custom date range requires startDate and endDate' });
                }
                start = new Date(startDate);
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                break;
            default:
                start = new Date(now.setDate(now.getDate() - 30)); // Default to last 30 days
                end = new Date();
        }

        
        const orders = await Order.find({
            orderDate: { $gte: start, $lte: end },
            paymentStatus: 'Paid' 
        }).populate('products.productId');

        
        let overallSalesCount = orders.length;
        let overallOrderAmount = 0;
        let overallDiscount = 0;
        let overallCouponDiscount = 0;

        orders.forEach(order => {
            overallOrderAmount += order.total;
            overallDiscount += order.offerDiscount || 0;
            overallCouponDiscount += order.couponDiscount || 0;
        });

        const reportData = {
            orders,
            overallSalesCount,
            overallOrderAmount,
            overallDiscount,
            overallCouponDiscount,
            startDate: start,
            endDate: end
        };

        res.render('admin/sales-report', { reportData, filterType });
    } catch (error) {
        console.error('Error fetching sales report:', error);
        res.status(500).send('Internal Server Error');
    }
};

const downloadSalesReport = async (req, res) => {
    try {
        const { filterType, startDate, endDate, format } = req.query;

        
        let start, end;
        const now = new Date();
        switch (filterType) {
            case 'daily':
                start = new Date(now.setHours(0, 0, 0, 0));
                end = new Date(now.setHours(23, 59, 59, 999));
                break;
            case 'weekly':
                start = new Date(now.setDate(now.getDate() - now.getDay()));
                start.setHours(0, 0, 0, 0);
                end = new Date(now.setDate(start.getDate() + 6));
                end.setHours(23, 59, 59, 999);
                break;
            case 'monthly':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'yearly':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
                end.setHours(23, 59, 59, 999);
                break;
            case 'custom':
                start = new Date(startDate);
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                break;
            default:
                start = new Date(now.setDate(now.getDate() - 30));
                end = new Date();
        }

        const orders = await Order.find({
            orderDate: { $gte: start, $lte: end },
            paymentStatus: 'Paid'
        }).populate('products.productId');

        let overallSalesCount = orders.length;
        let overallOrderAmount = 0;
        let overallDiscount = 0;
        let overallCouponDiscount = 0;

        orders.forEach(order => {
            overallOrderAmount += order.total;
            overallDiscount += order.offerDiscount || 0;
            overallCouponDiscount += order.couponDiscount || 0;
        });

        const downloadsDir = path.resolve(__dirname, '../../public/downloads');
        console.log('Downloads directory:', downloadsDir);

        try {
            if (!fs.existsSync(downloadsDir)) {
                console.log('Creating downloads directory...');
                fs.mkdirSync(downloadsDir, { recursive: true });
            } else {
                console.log('Downloads directory already exists');
            }

            fs.accessSync(downloadsDir, fs.constants.W_OK);
            console.log('Downloads directory is writable');
        } catch (permError) {
            console.error('Downloads directory error:', permError);
            return res.status(500).json({ success: false, message: 'Cannot access or create downloads directory' });
        }

        if (format === 'pdf') {
            const doc = new PDFDocument({ margin: 50 });
            const fileName = `sales-report-${Date.now()}.pdf`;
            const filePath = path.join(downloadsDir, fileName);

            
            await new Promise((resolve, reject) => {
                const stream = fs.createWriteStream(filePath);
                doc.pipe(stream);

                // Header styling
                doc.font('Times-Roman')
                    .fontSize(30)
                    .fillColor('#2563eb')
                    .text('Sales Report', { align: 'center' });

                doc.fontSize(12)
                    .fillColor('#1f2937')
                    .text(`Period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`, { align: 'center' });

                doc.moveDown(2);

                // Summary Section
                doc.font('Times-Bold')
                    .fontSize(16)
                    .fillColor('#1f2937')
                    .text('Summary', { underline: true });

                doc.font('Times-Roman')
                    .fontSize(12)
                    .moveDown(0.5);

                
                const formatNumber = (num) => parseFloat(num).toFixed(2);

                doc.text(`Total Orders: ${overallSalesCount}`, { align: 'left' })
                    .text(`Total Amount: ₹${formatNumber(overallOrderAmount)}`, { align: 'left' })
                    .text(`Offer Discount: ₹${formatNumber(overallDiscount)}`, { align: 'left' })
                    .text(`Coupon Discount: ₹${formatNumber(overallCouponDiscount)}`, { align: 'left' });

                doc.moveDown(2);

                // Order Details Section
                doc.font('Times-Bold')
                    .fontSize(16)
                    .text('Order Details', { underline: true });

                doc.font('Times-Roman')
                    .fontSize(12)
                    .moveDown(1);

                orders.forEach((order, index) => {
                    doc.text(`${index + 1}. Order ID: ${order.orderId}`)
                        .text(`   Date: ${order.orderDate.toLocaleString()}`)
                        .text(`   Total: ₹${formatNumber(order.total)}`)
                        .text(`   Offer Discount: ₹${formatNumber(order.offerDiscount || 0)}`)
                        .text(`   Coupon Discount: ₹${formatNumber(order.couponDiscount || 0)}`)
                        .moveDown(1);
                });

                doc.end();
                stream.on('finish', () => {
                    console.log('PDF file written successfully:', filePath);
                    resolve();
                });
                stream.on('error', (err) => {
                    console.error('Error writing PDF file:', err);
                    reject(err);
                });
            });

            if (!fs.existsSync(filePath)) {
                console.error('PDF file does not exist:', filePath);
                return res.status(500).json({ success: false, message: 'Failed to generate PDF: file not found' });
            }

            res.download(filePath, fileName, (err) => {
                if (err) {
                    console.error('Error during download:', err);
                    res.status(500).json({ success: false, message: 'Error downloading PDF' });
                }
                fs.unlink(filePath, (unlinkErr) => {
                    if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                        console.error('Error deleting file:', unlinkErr);
                    } else {
                        console.log('PDF file deleted successfully:', filePath);
                    }
                });
            });
        } else if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');
            const fileName = `sales-report-${Date.now()}.xlsx`;
            const filePath = path.join(downloadsDir, fileName);

            worksheet.columns = [
                { header: 'Order ID', key: 'orderId', width: 30 },
                { header: 'Date', key: 'date', width: 25 },
                { header: 'Total (₹)', key: 'total', width: 15 },
                { header: 'Offer Discount (₹)', key: 'offerDiscount', width: 20 },
                { header: 'Coupon Discount (₹)', key: 'couponDiscount', width: 20 }
            ];

            worksheet.addRow(['Summary', '', '', '', '']);
            worksheet.addRow(['Total Orders', overallSalesCount, '', '', '']);
            worksheet.addRow(['Total Amount', '', overallOrderAmount.toFixed(2), '', '']);
            worksheet.addRow(['Offer Discount', '', '', overallDiscount.toFixed(2), '']);
            worksheet.addRow(['Coupon Discount', '', '', '', overallCouponDiscount.toFixed(2)]);
            worksheet.addRow([]);

            worksheet.addRow(['Order Details', '', '', '', '']);
            orders.forEach(order => {
                worksheet.addRow({
                    orderId: order.orderId,
                    date: order.orderDate.toLocaleString(),
                    total: order.total.toFixed(2),
                    offerDiscount: (order.offerDiscount || 0).toFixed(2),
                    couponDiscount: (order.couponDiscount || 0).toFixed(2)
                });
            });

            try {
                await workbook.xlsx.writeFile(filePath);

                if (!fs.existsSync(filePath)) {
                    console.error('Excel file does not exist:', filePath);
                    return res.status(500).json({ success: false, message: 'Failed to generate Excel: file not found' });
                }

                res.download(filePath, fileName, (err) => {
                    if (err) {
                        console.error('Error during download:', err);
                        res.status(500).json({ success: false, message: 'Error downloading Excel' });
                    } else {
                        console.log('Excel download completed:', filePath);
                    }
                    fs.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                            console.error('Error deleting file:', unlinkErr);
                        } else {
                            console.log('Excel file deleted successfully:', filePath);
                        }
                    });
                });
            } catch (writeError) {
                console.error('Error writing Excel:', writeError);
                res.status(500).json({ success: false, message: 'Failed to generate Excel' });
            }
        } else {
            return res.status(400).json({ success: false, message: 'Invalid format' });
        }
    } catch (error) {
        console.error('Error downloading sales report:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = { 
    getSalesReport, 
    downloadSalesReport 
};