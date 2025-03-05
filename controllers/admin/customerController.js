const User = require('../../models/userSchema');


const customerInfo = async (req, res) => {
    try {
        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1;
        const limit = 3;

        
        const userData = await User.find(
            {
                isAdmin: false,
                $or: [
                    { userName: { $regex: ".*" + search + ".*", $options: "i" } },
                    { email: { $regex: ".*" + search + ".*", $options: "i" } }
                ]
            },
            { userName: 1, email: 1, isBlocked: 1, createdAt: 1 } 
        )
        .sort({createdAt:-1})
        .limit(limit)
        .skip((page - 1) * limit)
        .exec();

        // Count total users for pagination
        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        });

        // Render user-management with pagination data
        res.render("admin/userManagement", {
            users: userData,
            totalUsers: count,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            search: search
        });

    } catch (error) {
        console.log("Error loading customer management page:", error);
        res.redirect("/admin/pageerror");
    }
};

const blockCustomer = async (req,res)=>{
    try {
        const userId = req.params.id;

        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        user.isBlocked = !user.isBlocked; 
        await user.save();

        res.json({ success: true, newStatus: user.isBlocked });
    } catch (error) {
        console.error("Error updating user status:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}





module.exports = {
    customerInfo, blockCustomer, 

}