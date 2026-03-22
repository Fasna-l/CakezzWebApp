const RESPONSE_MESSAGES = {
  SUCCESS: "Success",
  SERVER_ERROR: "Something went wrong",
  ORDER_PLACED: "Order placed successfully",
  ORDER_NOT_FOUND: "Order not found",
  INVALID_COUPON: "Invalid coupon",
  PRODUCT_NOT_FOUND: "Product not found",
  COD_LIMIT_EXCEEDED:"Cash on delivery is not available for orders above ₹1000. Please choose another payment method.",
  WALLET_EMPTY:"No wallet balance. Please choose another payment method.",
  
  ADDRESS_ADDED: "Address added",
  ADDRESS_UPDATED: "Address updated successfully",
  ADDRESS_DELETED: "Address deleted",
  ADDRESS_NOT_FOUND: "Address not found",
  DEFAULT_ADDRESS_UPDATED: "Default address updated",
  MISSING_FIELDS: "Missing required fields",

  CART_EMPTY: "Cart is empty",
  CART_NOT_FOUND: "Cart not found",
  ITEM_NOT_FOUND: "Item not found",
  INVALID_REQUEST: "Invalid request",
  PRODUCT_UNAVAILABLE: "Product unavailable",
  INVALID_SIZE: "Invalid size",
  OUT_OF_STOCK: "Out of stock",
  NOT_ENOUGH_STOCK: "Not enough stock",
  MAX_LIMIT_REACHED: "Maximum 5 per item allowed",
  ADDED_TO_CART: "Added to cart",
  WISHLIST_ADDED: "Added to wishlist",
  WISHLIST_REMOVED: "Removed from wishlist",
  CART_REMOVED: "Removed from cart",
  LOGIN_REQUIRED: "Please login to continue",

  COUPON_REQUIRED: "Coupon code is required",
  COUPON_ALREADY_APPLIED: "Coupon already applied",
  COUPON_NOT_ASSIGNED: "This coupon is not assigned to you",
  COUPON_NOT_VALID: "Coupon not valid right now",
  COUPON_USAGE_LIMIT: "Coupon usage limit reached",
  COUPON_ALREADY_USED: "You have already used this coupon",

  RETURN_REASON_REQUIRED: "Reason is required",
  RETURN_PERIOD_EXPIRED: "Return period expired. Returns allowed only within 2 hours of delivery",

  OTP_REQUIRED: "OTP is required",
  OTP_INVALID: "Invalid OTP",
  OTP_EXPIRED: "OTP expired or not found",
  OTP_RESENT: "OTP resent successfully",

  USER_NOT_FOUND: "User not found",
  EMAIL_ALREADY_EXISTS: "Email already registered",
  EMAIL_UPDATED: "Email updated successfully",
  EMAIL_MISMATCH: "Old email does not match your current email",

  SESSION_EXPIRED: "Session expired. Please try again",
  EMAIL_SEND_FAILED: "Failed to send OTP. Please try again",

  PASSWORD_MISMATCH: "Passwords do not match",
  OLD_PASSWORD_INCORRECT: "Old password is incorrect",
  PASSWORD_CHANGED: "Password changed successfully",
  GOOGLE_EMAIL_CHANGE_NOT_ALLOWED: "Google users cannot change email",

  ADMIN_INVALID_CREDENTIALS: "Invalid email or password",

  COUPON_ALREADY_EXISTS: "Coupon code already exists",
  INVALID_DISCOUNT_VALUE: "Invalid discount value",
  INVALID_PERCENTAGE: "Percentage cannot exceed 100%",
  COUPON_NOT_FOUND: "Coupon not found",

  CATEGORY_ALREADY_EXISTS: "Category already exists",
  CATEGORY_ADDED: "Category added successfully",
  CATEGORY_UPDATED: "Category updated successfully",
  CATEGORY_LISTED: "Category listed successfully",
  CATEGORY_UNLISTED: "Category unlisted successfully",
  CATEGORY_NOT_FOUND: "Category not found",

  CATEGORY_OFFER_ALREADY_EXISTS: "An active offer already exists for this category",
  CATEGORY_OFFER_ADDED: "Category offer added successfully",
  CATEGORY_OFFER_UPDATED: "Category offer updated successfully",
  CATEGORY_OFFER_DELETED: "Category offer deleted successfully",

  OFFER_CREATED: "Offer created and assigned to product",
  OFFER_UPDATED: "Offer updated successfully",
  OFFER_DELETED: "Offer deleted successfully",
  OFFER_NOT_FOUND: "Offer not found",

  CUSTOMER_BLOCKED: "Customer blocked successfully",
  CUSTOMER_UNBLOCKED: "Customer unblocked successfully",

  PRODUCT_CREATED: "Product created successfully",
  PRODUCT_UPDATED: "Product updated successfully",
  PRODUCT_BLOCKED: "Product blocked successfully",
  PRODUCT_UNBLOCKED: "Product unblocked successfully",
  PRODUCT_ALREADY_EXISTS: "Product already exists. Choose another name",
  INVALID_CATEGORY: "Invalid category selected",
  MIN_PRODUCT_IMAGES: "Upload at least 3 product images",

  SALES_REPORT_LOAD_FAILED: "Failed to load sales report",
  
  BANNER_IMAGE_REQUIRED: "Please upload a banner image",
  MAX_BANNER_LIMIT: "Maximum 10 banners allowed",
  MIN_BANNER_LIMIT: "Minimum 3 banners required",
  BANNER_NOT_FOUND: "Banner not found",

};

export default RESPONSE_MESSAGES;