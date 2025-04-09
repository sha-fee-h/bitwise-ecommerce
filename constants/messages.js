module.exports = {
    //login-related messages
    INCORRECT_PASSWORD : 'Incorrect Password',
    INVALID_EMAIL : 'Invalid Emai',
    FAILED_LOGIN : 'login failed , please try again later',

    //category , product related messages
    ADD_SUCCESS : (dash)=>`${dash} added successfully!`,
    ADD_FAILED : (dash)=>`Failed to add ${dash}.`,
    EXISTING_NAME : (dash)=>`${dash} already exists!`,
    NOT_FOUND : (dash)=>`${dash} not found.`,
    UPDATE_SUCCESS : (dash)=>`${dash} updated successfully!`,
    UPDATE_FAILED : (dash)=>`Failed to update ${dash}`,
    UNLIST_SUCCESS : (dash)=>`${dash} listed successfully!`,
    UNLIST_FAILED : (dash)=>`Failed to list ${dash}`,

    //coupon related messages
    COUPON_FETCH_FAILED : `failed to fetch coupons`,
    COUPON_TOGGLE_FAILED : `failed to toggle coupon status`,
    COUPON_MIN_SPEND : 'minimum spend should be greater than discount amount',

    //inventroy related messages
    NEGATIVE_STOCK : `Stock cannot be negaitve`,
    STOCK_UPDATE_FAILED : `Failed to update stock`,

    //signup related messages
    PASSWORD_MISMATCH : `Password does not match`,
    INVALID_REFERRAL : 'Invalid Referral Code',
    INVALID_OTP : 'Invalid OTP, please try again',
    RESEND_OTP_SUCCESS : 'OTP resent successfully',
    RESEND_OTP_FAILURE : 'Failed to resent otp , Please try again',
    BLOCKED_USER : 'You are blocked by admin',
    SEND_OTP : 'OTP send to your email',
    FAILED_SEND_OTP : 'Failed to send OTP.',
    OTP_VERIFIED : "OTP verified! Set a new password.",
    RESET_PASSWORD_SUCCESS: "Password reset successful! You can now log in.",
    RESET_PASSWORD_FAILED : "Failed to reset password.",

    // Order-related messages
    ORDER_NOT_FOUND: 'Order not found',
    CANNOT_CANCEL_ITEM: 'Cannot cancel item as the order is already cancelled, delivered, or returned',
    PRODUCT_NOT_FOUND_IN_ORDER: 'Product not found in order',
    ITEM_ALREADY_CANCELLED: 'Item already cancelled',
    ITEM_CANCELLED_SUCCESS: 'Item cancelled successfully',

    // Refund-related messages
    REFUNDED_TO_WALLET: (amount, productId, orderId) =>
        `Refunded ₹${amount.toFixed(2)} to wallet for item ${productId} in order ${orderId}`,

    // General error messages
    INTERNAL_SERVER_ERROR: 'Internal Server Error',

    //sales-report messages
    INVALID_DATE_RANGE: 'Custom date range requires startDate and endDate',

    //cart - related messages
    PRODUCT_UNLISTED: `Product is unavailable`,
    CATEGORY_UNLISTED: 'Category is unavailbale',
    CART_NOT_FOUND: 'Cart not found',
    PRODUCT_NOT_FOUND_IN_CART: 'Product not found in cart',
    CART_EMPTY: 'Your cart is empty',
    PRODUCT_OUT_OF_STOCK: `Insufficient stock`,
    ORDER_PLACED_SUCCESS: 'Order placed successfully',
    COUPON_VALIDATION_FAILED: 'Coupon validation failed',
    PRODUCT_UNAVAILABLE: 'Product is unavailable',
    
    USER_NOT_AUTHENTICATED: 'User not authenticated',
    PRODUCT_NOT_FOUND: 'Product not found in cart',
    INVALID_QUANTITY: 'Quantity must be a positive number',
    NOT_ENOUGH_STOCK: `Not enough stock available`,
    MAX_QUANTITY_EXCEEDED: `Cannot add more than 5 units of product`,
    PRODUCT_NOT_AVAILABLE: 'Product is not available',
    PRODUCT_ADDED_TO_CART: 'Product added to cart successfully',
    
};