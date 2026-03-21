import Order from "../../models/orderSchema.js";
import Product from "../../models/productSchema.js";
import User from "../../models/userSchema.js";
import Wallet from "../../models/walletSchema.js";
import PDFDocument from "pdfkit";
import logger from "../../utils/logger.js";
import HTTP_STATUS from "../../utils/httpStatus.js";
import RESPONSE_MESSAGES from "../../utils/responseMessages.js";

const loadOrderList = async (req, res, next) => {
  try {
    const userId = req.session.user;

    const search = req.query.q ? req.query.q.trim() : "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    // Build search query
    const query = { userId: userId };
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { "items.productName": { $regex: search, $options: "i" } }
      ];
    }

    const totalOrders = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit);

    const pagination = {
      totalPages: Math.ceil(totalOrders / limit),
      currentPage: page
    };

    const user = await User.findById(userId).lean();
    res.render("orderList", {
      user,
      orders,
      pagination,
      q: search
    });

  } catch (error) {
    next(error);
  }
};

const loadOrderDetails = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;

    const order = await Order.findById(orderId);
    if (!order || order.userId.toString() !== userId.toString()) {
      return res.redirect("/order");
    }

    const cancelCouponError = req.session.cancelCouponError || null;
    req.session.cancelCouponError = null;

    const user = await User.findById(userId).lean();
    res.render("orderDetails", {user, order , cancelCouponError });

  } catch (error) {
    next(error);
  }
};

const loadCancelPage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;
    const itemId = req.query.item || null;

    const order = await Order.findById(orderId);
    if (!order || order.userId.toString() !== userId.toString()) {
      return res.redirect("/order");
    }
    if (order.orderStatus !== "Pending") {
      return res.redirect(`/order/${orderId}`);
    }

    // CHECK: If single item cancel requested
    if (itemId) {
      const item = order.items.id(itemId);
      if (!item) return res.redirect(`/order/${orderId}`);

      // item must also be pending to cancel
      if (item.status !== "Pending") {
        return res.redirect(`/order/${orderId}`);
      }
    }
    // Pass itemId to EJS
    const user = await User.findById(userId).lean();
    res.render("cancelOrder", {user, order, itemId });

  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const { reason, itemId } = req.body;
    const orderId = req.params.id;
    const userId = req.session.user;

    const order = await Order.findById(orderId);
    if (!order || order.userId.toString() !== userId.toString()) {
      return res.redirect("/order");
    }

    // Block cancel if order not Pending
    if (order.orderStatus !== "Pending") {
      return res.redirect(`/order/${orderId}`);
    }

    // Track refund amount
    let refundAmount = 0;
    // CANCEL SINGLE ITEM
    if (itemId) {
      const item = order.items.id(itemId);
      if (!item) return res.redirect(`/order/${orderId}`);

      if (item.status !== "Pending") {
        return res.redirect(`/order/${orderId}`);
      }
      // Compute current subtotal of non-cancelled items
      const currentSubtotal = order.items.reduce((sum, it) =>
        it.status !== "Cancelled" ? sum + it.price * it.quantity : sum
      , 0);

      const itemValue = item.price * item.quantity;
      const newSubtotal = currentSubtotal - itemValue;

      // If coupon applied & violation happens → block single cancel
      if (order.couponCode && newSubtotal < order.couponMinPurchase) {
      // Redirect back with an error message
        req.session.cancelCouponError = 
          `Cannot cancel this item because it will break the coupon minimum purchase condition (₹${order.couponMinPurchase}). Cancel entire order instead.`;

        return res.redirect(`/order/${orderId}`);
      }

      // If OK → continue to normal single item cancel logic...

      // Calculate refund for this item
      refundAmount = calculateRefundWithCoupon(order, item);
      // Restore stock
      const product = await Product.findById(item.productId);
      const variant = product.variants.find(v => v.size === item.size);
      if (variant) {
        variant.stock += item.quantity;
        await product.save();
      }

      // Update item status
      item.status = "Cancelled";
      item.cancellationReason = reason || "No reason provided";
      item.cancelledAt = new Date();

      item.refundAmount = refundAmount;
      item.refundStatus = "Processed";

      order.markModified("items");
      recalculateOrderTotals(order);
      // Check if ALL items are cancelled
      const allCancelled = order.items.every(it => it.status === "Cancelled");

      if (allCancelled) {
        order.orderStatus = "Cancelled";
        order.cancellationReason = reason || "No reason provided";
        order.cancelledAt = new Date();

        order.refundAmount = refundAmount;
        order.refundStatus = "Processed";

        order.statusHistory.push({
          status: "Order Cancelled",
          comment: "All items cancelled",
          date: new Date()
        });

      } else {
        order.statusHistory.push({
          status: "Item Cancelled",
          comment: `Cancelled item: ${item.productName}`,
          date: new Date()
        });
      }
    }
    // CANCEL FULL ORDER
    else {
      refundAmount = 0;

      for (let it of order.items) {

       // only refund for non-cancelled items
        if (it.status !== "Cancelled") {
          const itemRefund = calculateRefundWithCoupon(order, it);
          refundAmount += itemRefund;
          
        // restore stock
          const product = await Product.findById(it.productId);
          const variant = product.variants.find(v => v.size === it.size);
          if (variant) {
            variant.stock += it.quantity;
            await product.save();
          }

          it.refundAmount = itemRefund;
          it.refundStatus = "Processed";
        }

    // mark status cancelled for all items
        it.status = "Cancelled";
        it.cancellationReason = reason || "No reason provided";
        it.cancelledAt = new Date();
      }

      order.orderStatus = "Cancelled";
      order.cancellationReason = reason || "No reason provided";
      order.cancelledAt = new Date();

      order.statusHistory.push({
        status: "Order Cancelled",
        comment: reason,
        date: new Date()
      });
      recalculateOrderTotals(order);
    }
    //  WALLET REFUND
    if (refundAmount > 0 && order.paymentStatus === "Paid") {
      let wallet = await Wallet.findOne({ userId: order.userId });

      if (!wallet) {
        wallet = await Wallet.create({ userId: order.userId, balance: 0 });
      }

      await wallet.addTransaction({
        type: "refund",
        amount: refundAmount,
        orderId: order._id,
        description: itemId
          ? "Refund for cancelled item"
          : "Refund for cancelled order"
      });
      order.refundAmount = refundAmount;
      order.refundStatus = "Processed";
    }
    await order.save();
    if (itemId) {
      logger.info(
        `ITEM CANCELLED | UserId: ${userId} | OrderId: ${order._id} | Item: ${itemId} | Refund: ${refundAmount}`
      );
    } else {
      logger.warn(
        `ORDER CANCELLED | UserId: ${userId} | OrderId: ${order._id} | Refund: ${refundAmount}`
      );
    }
    return res.redirect(`/order/${orderId}`);

  } catch (error) {
    next(error);
  }
};

//RETURN ORDER (Delivered Only) + Mandatory Reason
const loadReturnPage = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    const user = await User.findById(order.userId).lean();
    res.render("returnOrder", { user,order });
  } catch (error) {
    next(error);
  }
};

const submitReturnRequest = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const reason = req.body.reason;

    if (!reason || reason.trim() === "") {
      return res.status(HTTP_STATUS.BAD_REQUEST).send(
        RESPONSE_MESSAGES.RETURN_REASON_REQUIRED
      );
    }

    const order = await Order.findById(orderId);
    if (!order) return res.redirect("/order");

    //check return time limit(2hours)
    if(!order.deliveryDate){
      return res.redirect(`/order/${orderId}`);
    }
    const now = new Date();
    const deliveryTime = new Date(order.deliveryDate);

    const diffInMs = now - deliveryTime;
    const diffInHours = diffInMs / (1000*60*60);

    if(diffInHours >2){
      return res.status(HTTP_STATUS.BAD_REQUEST).send(
        RESPONSE_MESSAGES.RETURN_PERIOD_EXPIRED
      );
    }
    // Update order status
    order.orderStatus = "Return Requested";

    // Update ALL items
    order.items.forEach(item => {
      if (item.status === "Delivered") {
        item.status = "Return Requested";
        item.returnReason = reason;
        item.returnedAt = new Date();
      }
    });

    // Add history
    order.statusHistory.push({
      status: "Return Requested",
      comment: reason,
      date: new Date()
    });

    order.markModified("items");
    recalculateOrderTotals(order);
    await order.save();
    logger.info(
      `RETURN REQUESTED | UserId: ${order.userId} | OrderId: ${order._id} | Type: Full Order`
    );
    res.redirect(`/order/${orderId}`);

  } catch (error) {
    next(error);
  }
};

//DOWNLOAD INVOICE PDF
const downloadInvoice = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    logger.info(
      `INVOICE DOWNLOADED | UserId: ${order.userId} | OrderId: ${order._id}`
    );
    const user = await User.findById(order.userId).lean();

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_${order.orderId}.pdf`
    );

    doc.pipe(res);

    // HEADER
    doc.fontSize(26).text("Cakez.in", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(16).text("Invoice", { align: "center" });
    doc.moveDown(1.2);

    // CUSTOMER DETAILS
    doc.fontSize(14).text("Customer Details", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(12).text(`Name: ${user.name || "N/A"}`);
    doc.text(`Email: ${user.email || "N/A"}`);
    doc.moveDown(1);

    // SHIPPING ADDRESS
    const s = order.shippingAddress;

    doc.fontSize(14).text("Shipping Address", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(12).text(
      `${s.streetAddress}, ${s.city}, ${s.district}, ${s.state} - ${s.pinCode}`
    );
    doc.text(`Phone: ${s.phoneNumber}`);
    doc.moveDown(1);

    // INVOICE DETAILS
    doc.fontSize(14).text("Invoice Details", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(12).text(`Invoice Number: ${order.orderId}`);
    doc.text(`Invoice Date: ${order.orderDate.toLocaleDateString("en-GB")}`);
    doc.text(`Payment Method: ${order.paymentMethod}`);
    doc.moveDown(1);

    // TABLE HEADER
    const tableTop = doc.y;

    doc.fontSize(13).text("Item Name", 50, tableTop);
    doc.text("Qty", 260, tableTop);
    doc.text("Status", 310, tableTop);
    doc.text("Unit Price", 400, tableTop);
    doc.text("Subtotal", 500, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
    doc.moveDown();

    // TABLE ROWS
    let calculatedSubTotal = 0;

    order.items.forEach(item => {
      const y = doc.y;
      let itemSubtotal = 0;

      if (
        item.status !== "Cancelled" &&
        item.status !== "Returned" &&
        !(item.status === "Return Requested" && item.returnStatus === "Approved")
      ) {
        itemSubtotal = item.price * item.quantity;
        calculatedSubTotal += itemSubtotal;
      }

      let displayStatus = item.status;

      if (item.returnStatus === "Approved") {
        displayStatus = "Return Approved";
      } else if (item.returnStatus === "Rejected") {
        displayStatus = "Return Rejected";
      } else if (item.status === "Return Requested") {
        displayStatus = "Return Requested";
      }

      doc.fontSize(12).text(item.productName, 50, y);
      doc.text(item.quantity.toString(), 260, y);
      doc.text(displayStatus, 310, y);
      doc.text(`Rs. ${item.price}`, 400, y);
      doc.text(`Rs. ${itemSubtotal}`, 500, y);

      doc.moveDown(0.7);
    });

    doc.moveDown(1);

    // PAYMENT SUMMARY
    doc.moveDown(0.5);
    const rightX = doc.page.width - 180;

    doc.fontSize(14).text("Payment Summary", rightX, doc.y, {
      underline: true
    });

    doc.moveDown(0.5);

    const tax = order.taxAmount || 0;
    const shipping = order.shippingCharge || 0;
    const offerDiscount = order.offerDiscount || 0;
    const couponDiscount = order.couponDiscount || 0;
    const grandTotal = order.totalAmount || 0;

    doc.fontSize(12).text(`Subtotal: Rs. ${calculatedSubTotal}`, { align: "left" });
    doc.text(`Tax: Rs. ${tax}`, { align: "left" });
    doc.text(`Shipping Charge: Rs. ${shipping}`, { align: "left" });

    if (offerDiscount > 0) {
      doc.text(`Offer Discount: Rs. ${offerDiscount}`, { align: "left" });
    }

    if (couponDiscount > 0) {
      doc.text(`Coupon Discount: Rs. ${couponDiscount}`, { align: "left" });
    }

    doc.moveDown(0.7);

    doc.fontSize(13).text(`Grand Total: Rs. ${grandTotal}`, {
      align: "left",
    });

    // FOOTER
    doc.moveDown(3);

    doc.fontSize(11).text(
      "Thank you for shopping with Cakez.in!",
      0,
      doc.y,
      { align: "center", width: doc.page.width }
    );

    doc.text(
      "Contact: support@cakez.in | +91 98765 43210",
      0,
      doc.y,
      { align: "center", width: doc.page.width }
    );

    doc.end();

  } catch (error) {
    next(error);
  }
};

const loadSingleReturnPage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const { orderId, itemId } = req.params;

    const order = await Order.findById(orderId);

    if (!order || order.userId.toString() !== userId.toString()) {
      return res.redirect("/order");
    }

    const item = order.items.id(itemId);
    if (!item) return res.redirect(`/order/${orderId}`);

    // You should only return items that are delivered
    if (item.status !== "Delivered") {
      return res.redirect(`/order/${orderId}`);
    }

    const user = await User.findById(order.userId).lean();
    res.render("return-Singleitem", { user, order, item });

  } catch (error) {
    next(error);
  }
};

const submitSingleReturn = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const { orderId, itemId } = req.params;
    const reason = req.body.reason;

    if (!reason || reason.trim() === "") {
      return res.status(HTTP_STATUS.BAD_REQUEST).send(
        RESPONSE_MESSAGES.RETURN_REASON_REQUIRED
      );
    }

    const order = await Order.findById(orderId);
    if (!order || order.userId.toString() !== userId.toString()) {
      return res.redirect("/order");
    }

    // Check return time limit (2 hours)
    if (!order.deliveryDate) {
      return res.redirect(`/order/${orderId}`);
    }

    const now = new Date();
    const deliveryTime = new Date(order.deliveryDate);

    const diffInMs = now - deliveryTime;
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours > 2) {
      return res.status(HTTP_STATUS.BAD_REQUEST).send(
        RESPONSE_MESSAGES.RETURN_PERIOD_EXPIRED
      );
    }


    const item = order.items.id(itemId);
    if (!item) return res.redirect(`/order/${orderId}`);

    // Only delivered items can be returned
    if (item.status !== "Delivered") {
      return res.redirect(`/order/${orderId}`);
    }

    // Update item status
    item.status = "Return Requested";
    item.returnReason = reason;
    item.returnedAt = new Date();

    // Add to order history
    order.statusHistory.push({
      status: "Item Return Requested",
      comment: `Return requested for: ${item.productName}`,
      date: new Date()
    });

    // If ALL items requested for return → update order-level status
    const allReturned = order.items.every(i =>
      ["Return Requested", "Returned"].includes(i.status)
    );

    if (allReturned) {
      order.orderStatus = "Return Requested";
    }

    order.markModified("items");
    recalculateOrderTotals(order);
    await order.save();
    logger.info(
      `RETURN REQUESTED | UserId: ${userId} | OrderId: ${order._id} | Item: ${itemId}`
    );
    res.redirect(`/order/${orderId}`);

  } catch (error) {
    next(error);
  }
};

//HELPER: RECALCULATE ORDER TOTALS
function recalculateOrderTotals(order) {

  // 1. Get valid items (not cancelled, not returned)
  const validItems = order.items.filter(item => {
    if (item.status === "Cancelled") return false;
    if (item.status === "Returned") return false;
    return true;
  });

  // 2. Calculate new subtotal
  const newSubTotal = validItems.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  // 3. Calculate original subtotal (before any return)
  const originalSubTotal = order.items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  // 4. Recalculate remaining coupon proportionally
  let newCouponDiscount = 0;

  if (order.originalCouponDiscount > 0 && originalSubTotal > 0) {
    newCouponDiscount = Math.round(
      (newSubTotal / originalSubTotal) * order.originalCouponDiscount 
    );
  }

  // 5. Recalculate tax & shipping
  const taxAmount = Math.round(newSubTotal * 0.05);
  const shippingCharge = newSubTotal > 0 ? 50 : 0;

  // 6. Update order fields
  order.subTotal = newSubTotal;
  order.couponDiscount = newCouponDiscount;
  order.taxAmount = taxAmount;
  order.shippingCharge = shippingCharge;

  order.totalAmount =
    newSubTotal + taxAmount + shippingCharge - newCouponDiscount;
}

function calculateRefundWithCoupon(order, item) {

  if (!order.couponCode || order.originalCouponDiscount <= 0) {
    return item.price * item.quantity;
  }

  const originalSubTotal = order.items.reduce((sum, i) => {
    return sum + i.price * i.quantity;
  }, 0);

  if (originalSubTotal <= 0) {
    return item.price * item.quantity;
  }

  const itemTotal = item.price * item.quantity;

  const couponShare =
    (itemTotal / originalSubTotal) * order.originalCouponDiscount;

  const refundAmount = itemTotal - couponShare;

  return Math.round(refundAmount);
}

export default {
  loadOrderList,
  loadOrderDetails,
  loadCancelPage,
  cancelOrder,
  loadReturnPage,
  submitReturnRequest,
  downloadInvoice,
  loadSingleReturnPage,
  submitSingleReturn
};