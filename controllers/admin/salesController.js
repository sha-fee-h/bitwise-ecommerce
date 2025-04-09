const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const MESSAGES = require('../../constants/messages')
const STATUS_CODES = require('../../constants/statusCodes');


const getSalesReport = async (req, res) => {
    try {
        const { filterType, startDate, endDate, page, limit } = req.query;

        
        const currentPage = parseInt(page) || 1; 
        const pageLimit = parseInt(limit) || 10; 
        const skip = (currentPage - 1) * pageLimit;

        
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
                    return res.status(STATUS_CODES.BAD_REQUEST).json({
                        success: false,
                        message: MESSAGES.INVALID_DATE_RANGE,
                    });
                }
                start = new Date(startDate);
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                break;
            default:
                start = new Date(now.setDate(now.getDate() - 30)); 
                end = new Date();
        }

        
        const orderFilter = {
            orderDate: { $gte: start, $lte: end },
            paymentStatus: 'Paid',
            deliveryStatus: { $ne: 'Cancelled' }, 
        };

        
        const totalOrders = await Order.countDocuments(orderFilter);

        
        const totalPages = Math.ceil(totalOrders / pageLimit);

        
        const orders = await Order.find(orderFilter)
            .populate('products.productId')
            .skip(skip)
            .limit(pageLimit).
            sort({createdAt:-1})

        
        let overallSalesCount = totalOrders; 
        let overallOrderAmount = 0;
        let overallDiscount = 0;
        let overallCouponDiscount = 0;

        
        const allOrdersForSummary = await Order.find(orderFilter);

        allOrdersForSummary.forEach(order => {
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
            endDate: end,
        };

        res.render('admin/sales-report', {
            reportData,
            filterType,
            currentPage,
            totalPages,
            pageLimit,
            totalOrders,
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
        });
    } catch (error) {
        console.error('Error fetching sales report:', error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.INTERNAL_SERVER_ERROR);
    }
}

const downloadSalesReport = async (req, res) => {
    try {
        const { filterType, startDate, endDate, format } = req.query;

        // Determine date range
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
            paymentStatus: 'Paid',
            deliveryStatus: { $ne: 'Cancelled' },
        }).populate('products.productId');

        
        let overallSalesCount = orders.length;
        let overallOrderAmount = 0;
        let overallDiscount = 0;
        let overallCouponDiscount = 0;
        let productStats = {};

        orders.forEach(order => {
            overallOrderAmount += order.total;
            overallDiscount += order.offerDiscount || 0;
            overallCouponDiscount += order.couponDiscount || 0;

            
            order.products.forEach(item => {
                const productId = item.productId._id.toString();
                if (!productStats[productId]) {
                    productStats[productId] = {
                        name: item.productId.name,
                        count: 0,
                        revenue: 0
                    };
                }
                productStats[productId].count += item.quantity;
                productStats[productId].revenue += item.price * item.quantity;
            });
        });

        
        const topProducts = Object.values(productStats)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

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
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const fileName = `sales-report-${Date.now()}.pdf`;
            const filePath = path.join(downloadsDir, fileName);

            await new Promise((resolve, reject) => {
                const stream = fs.createWriteStream(filePath);
                doc.pipe(stream);

                // Format for currency
                const formatCurrency = (num) => `₹${parseFloat(num).toFixed(2)}`;

                // Header styling with logo (if available)
                doc.font('Helvetica-Bold')
                    .fontSize(24)
                    .fillColor('##0d0e0f')
                    .text('SALES REPORT', { align: 'center' });

                doc.fontSize(12)
                    .fillColor('#1f2937')
                    .text(`Period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`, { align: 'center' });
                
                doc.moveDown(2);

                // Summary Section with styled table
                doc.font('Helvetica-Bold')
                    .fontSize(16)
                    .fillColor('#1f2937')
                    .text('Summary', { underline: true });
                
                doc.moveDown(1);

                // Summary table
                const summaryTableTop = doc.y;
                const summaryTableWidth = 300;
                
                // Draw table headers
                doc.font('Helvetica-Bold')
                    .fontSize(10)
                    .fillColor('#ffffff')
                    .rect(50, doc.y, summaryTableWidth, 20)
                    .fill('#ffffff')
                    .fillColor('#ffffff')
                    .text('Metric', 60, doc.y - 15, { width: 150 })
                    .text('Value', 210, doc.y - 15, { width: 150 });

                // Draw table rows
                doc.font('Helvetica')
                    .fontSize(10)
                    .fillColor('#1f2937');

                const addSummaryRow = (label, value, isAlternate = false) => {
                    if (isAlternate) {
                        doc.rect(50, doc.y, summaryTableWidth, 20).fill('#f3f4f6');
                    }
                    doc.fillColor('#1f2937')
                        .text(label, 60, doc.y + 5, { width: 150 })
                        .text(value, 210, doc.y - 10, { width: 150 });
                    doc.moveDown(1);
                };

                addSummaryRow('Total Orders', overallSalesCount.toString());
                addSummaryRow('Total Amount', formatCurrency(overallOrderAmount), true);
                addSummaryRow('Offer Discount', formatCurrency(overallDiscount));
                addSummaryRow('Coupon Discount', formatCurrency(overallCouponDiscount), true);
                addSummaryRow('Net Revenue', formatCurrency(overallOrderAmount - overallDiscount - overallCouponDiscount));
                
                doc.moveDown(2);

                // Top Products Section
                if (topProducts.length > 0) {
                    doc.font('Helvetica-Bold')
                        .fontSize(16)
                        .text('Top Selling Products', { underline: true });
                    
                    doc.moveDown(1);

                    // Product table headers
                    const productTableTop = doc.y;
                    const productTableWidth = 500;
                    
                    doc.font('Helvetica-Bold')
                        .fontSize(10)
                        .fillColor('#ffffff')
                        .rect(50, doc.y, productTableWidth, 20)
                        .fill('#ffffff')
                        .fillColor('#ffffff')
                        .text('Product Name', 60, doc.y - 15, { width: 250 })
                        .text('Units Sold', 310, doc.y - 15, { width: 100 })
                        .text('Revenue', 410, doc.y - 15, { width: 100 });

                    // Product table rows
                    doc.font('Helvetica')
                        .fontSize(10)
                        .fillColor('#1f2937');

                    topProducts.forEach((product, index) => {
                        const isAlternate = index % 2 === 1;
                        if (isAlternate) {
                            doc.rect(50, doc.y, productTableWidth, 20).fill('#f3f4f6');
                        }
                        doc.fillColor('#1f2937')
                            .text(product.name, 60, doc.y + 5, { width: 250 })
                            .text(product.count.toString(), 310, doc.y - 10, { width: 100 })
                            .text(formatCurrency(product.revenue), 410, doc.y - 10, { width: 100 });
                        doc.moveDown(1);
                    });

                    doc.moveDown(2);
                }

                // Order Details Section
                doc.font('Helvetica-Bold')
                    .fontSize(16)
                    .text('Order Details', { underline: true });
                
                doc.moveDown(1);

                // Order table headers
                const orderTableWidth = 500;
                
                doc.font('Helvetica-Bold')
                    .fontSize(10)
                    .fillColor('#ffffff')
                    .rect(50, doc.y, orderTableWidth, 20)
                    .fill('#ffffff')
                    .fillColor('#ffffff')
                    .text('Order ID', 60, doc.y - 15, { width: 120 })
                    .text('Date', 180, doc.y - 15, { width: 120 })
                    .text('Total', 300, doc.y - 15, { width: 80 })
                    .text('Discount', 380, doc.y - 15, { width: 80 })
                    .text('Net', 460, doc.y - 15, { width: 80 });

                // Order table rows
                doc.font('Helvetica')
                    .fontSize(9)
                    .fillColor('#1f2937');

                // Limit to first 50 orders for PDF readability
                const maxOrdersToShow = Math.min(orders.length, 50);
                for (let i = 0; i < maxOrdersToShow; i++) {
                    const order = orders[i];
                    const isAlternate = i % 2 === 1;
                    
                    if (doc.y > 700) {  // Check if we need a new page
                        doc.addPage();
                        
                        // Add header to new page
                        doc.font('Helvetica-Bold')
                            .fontSize(14)
                            .fillColor('##0d0e0f')
                            .text('SALES REPORT (continued)', { align: 'center' });
                        
                        doc.moveDown(1);
                        
                        // Repeat table headers on new page
                        doc.font('Helvetica-Bold')
                            .fontSize(10)
                            .fillColor('#ffffff')
                            .rect(50, doc.y, orderTableWidth, 20)
                            .fill('#ffffff')
                            .fillColor('#ffffff')
                            .text('Order ID', 60, doc.y - 15, { width: 120 })
                            .text('Date', 180, doc.y - 15, { width: 120 })
                            .text('Total', 300, doc.y - 15, { width: 80 })
                            .text('Discount', 380, doc.y - 15, { width: 80 })
                            .text('Net', 460, doc.y - 15, { width: 80 });
                        
                        doc.font('Helvetica')
                            .fontSize(9)
                            .fillColor('#1f2937');
                    }
                    
                    if (isAlternate) {
                        doc.rect(50, doc.y, orderTableWidth, 20).fill('#f3f4f6');
                    }
                    
                    const totalDiscount = (order.offerDiscount || 0) + (order.couponDiscount || 0);
                    const netAmount = order.total - totalDiscount;
                    
                    doc.fillColor('#1f2937')
                        .text(order.orderId, 60, doc.y + 5, { width: 120 })
                        .text(order.orderDate.toLocaleDateString(), 180, doc.y - 10, { width: 120 })
                        .text(formatCurrency(order.total), 300, doc.y - 10, { width: 80 })
                        .text(formatCurrency(totalDiscount), 380, doc.y - 10, { width: 80 })
                        .text(formatCurrency(netAmount), 460, doc.y - 10, { width: 80 });
                    
                    doc.moveDown(1);
                }
                
                if (orders.length > maxOrdersToShow) {
                    doc.text(`Note: Showing ${maxOrdersToShow} of ${orders.length} orders in this report.`, { 
                        align: 'center',
                        italic: true
                    });
                }

                // Footer with page numbers
                // let currentPage = 1;

                // // Function to add page footer
                // const addPageFooter = () => {
                //     doc.fontSize(8)
                //         .fillColor('#6b7280')
                //         .text(
                //             `Page ${currentPage}`, 
                //             0, 
                //             doc.page.height - 30, 
                //             { align: 'center' }
                //         );
                // };

                // // Add footer to first page
                // addPageFooter();

                // // When adding a new page
                // doc.addPage();
                // currentPage++;
                // addPageFooter();

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
                } else {
                    console.log('PDF download completed:', filePath);
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
        res.status(500).send(MESSAGES.INTERNAL_SERVER_ERROR);
    }
};

module.exports = { 
    getSalesReport, 
    downloadSalesReport 
};