const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const MESSAGES = require('../../constants/messages');
const STATUS_CODES = require('../../constants/statusCodes');


const getDashboardData = async (req, res) => {
    try {
        if (req.session.admin) {
            let { filterType } = req.query;

            let startDate, endDate, groupByFormat;
            const now = new Date();
            switch (filterType) {
                case 'daily':
                    
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1); 
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); 
                    endDate.setHours(23, 59, 59, 999);
                    groupByFormat = { $dateToString: { format: "%d", date: "$orderDate" } }; 
                    break;
                case 'monthly':
                    
                    startDate = new Date(now.getFullYear(), 0, 1); 
                    endDate = new Date(now.getFullYear(), 11, 31); 
                    endDate.setHours(23, 59, 59, 999);
                    groupByFormat = { $dateToString: { format: "%Y-%m", date: "$orderDate" } }; 
                    break;
                case 'yearly':
                    
                    startDate = new Date(2000, 0, 1); 
                    endDate = new Date(now.getFullYear(), 11, 31);
                    endDate.setHours(23, 59, 59, 999);
                    groupByFormat = { $dateToString: { format: "%Y", date: "$orderDate" } }; 
                    break;
                default:
                    
                    filterType = 'daily';
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    endDate.setHours(23, 59, 59, 999);
                    groupByFormat = { $dateToString: { format: "%d", date: "$orderDate" } };
            }

            
            const salesData = await Order.aggregate([
                {
                    $match: {
                        orderDate: { $gte: startDate, $lte: endDate },
                        paymentStatus: 'Paid',
                        deliveryStatus: { $ne: 'Cancelled' }
                    }
                },
                {
                    $group: {
                        _id: groupByFormat,
                        totalSales: { $sum: '$total' }
                    }
                },
                { $sort: { '_id': 1 } }
            ]);

            
            const salesLabels = salesData.map(data => {
                if (filterType === 'daily') {
                    return data._id; 
                } else if (filterType === 'monthly') {
                    const [year, month] = data._id.split('-');
                    return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
                } else {
                    return data._id; 
                }
            });
            const salesValues = salesData.map(data => data.totalSales);

            // Top 10 best-selling products
            const topProducts = await Order.aggregate([
                { $match: { paymentStatus: 'Paid', deliveryStatus: { $ne: 'Cancelled' } } },
                { $unwind: '$products' },
                {
                    $group: {
                        _id: '$products.productId',
                        totalSold: { $sum: '$products.quantity' },
                        totalRevenue: {
                            $sum: {
                                $multiply: [
                                    
                                    {
                                        $subtract: [
                                            '$products.price',
                                            { $ifNull: ['$products.offerDiscount', 0] }
                                        ]
                                    },
                                    '$products.quantity'
                                ]
                            }
                        }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: 'products',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                { $unwind: '$product' }
            ]);

            // Top 10 best-selling categories
            const topCategories = await Order.aggregate([
                { $match: { paymentStatus: 'Paid', deliveryStatus: { $ne: 'Cancelled' } } },
                { $unwind: '$products' },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'products.productId',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                { $unwind: '$product' },
                {
                    $group: {
                        _id: '$product.category',
                        totalSold: { $sum: '$products.quantity' },
                        totalRevenue: {
                            $sum: {
                                $multiply: [
                                    
                                    {
                                        $subtract: [
                                            '$products.price',
                                            { $ifNull: ['$products.offerDiscount', 0] }
                                        ]
                                    },
                                    '$products.quantity'
                                ]
                            }
                        }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: 'categories',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'category'
                    }
                },
                { $unwind: '$category' }
            ]);

            // Top 10 best-selling brands
            const topBrands = await Order.aggregate([
                { $match: { paymentStatus: 'Paid', deliveryStatus: { $ne: 'Cancelled' } } },
                { $unwind: '$products' },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'products.productId',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                { $unwind: '$product' },
                {
                    $group: {
                        _id: '$product.brand',
                        totalSold: { $sum: '$products.quantity' },
                        totalRevenue: {
                            $sum: {
                                $multiply: [
                                    
                                    {
                                        $subtract: [
                                            '$products.price',
                                            { $ifNull: ['$products.offerDiscount', 0] }
                                        ]
                                    },
                                    '$products.quantity'
                                ]
                            }
                        }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 10 }
            ]);

            res.render('admin/dashboard', {
                filterType,
                salesLabels: JSON.stringify(salesLabels),
                salesValues: JSON.stringify(salesValues),
                topProducts,
                topCategories,
                topBrands
            });
        }
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.INTERNAL_SERVER_ERROR);
    }
};

module.exports = { 
    getDashboardData 
};