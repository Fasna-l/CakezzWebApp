const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Wallet = require("../../models/walletSchema");

const loadOrderList = async (req, res, next) => {
  try {
    let {
      page = 1,
      search = "",
      status = "",
      date= ""
    } = req.query;

    page = parseInt(page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    let query = {};

    // Search by orderId or productName
    if (search.trim() !== "") {
      query.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { "items.productName": { $regex: search, $options: "i" } },
      ];
    }

    // Status Filter
    if (status !== "" && status !== "all") {
      query.orderStatus = status;
    }

    // Date Filter
    if (date) {
      const now = new Date();
      let startDate;

      if (date === "today") {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        query.orderDate = { $gte: startDate };
      }

      if (date === "week") {
        startDate = new Date();
        startDate.setDate(now.getDate() - 7);
        query.orderDate = { $gte: startDate };
      }

      if (date === "month") {
        startDate = new Date();
        startDate.setMonth(now.getMonth() - 1);
        query.orderDate = { $gte: startDate };
      }
    }
    const totalOrders = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .populate("userId", "name")
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalOrders / limit);

    const formattedOrders = orders.map((order) => ({
      _id: order._id,
      id: order.orderId,
      customerName: order.userId?.name || "Unknown",
      address: `${order.shippingAddress.streetAddress}, ${order.shippingAddress.city}`,
      date: new Date(order.orderDate).toLocaleDateString("en-GB"),
      type: order.paymentMethod,
      status: order.orderStatus,
    }));

    res.render("adminOrderList", {
      orders: formattedOrders,
      search,
      status,
      date,
      currentPage: page,
      totalPages
    });

  } catch (error) {
      next(error);
  }
};

const loadOrderDetails = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).populate("userId").lean();

    if (!order) {
      return res.render("adminOrderDetails", {
        order: {},
        toastMessage: "Order not found!",
        toastType: "error"
      });
    }

    // Always send defaults to avoid undefined errors( in toast message)
    res.render("adminOrderDetails", {
      order,
      toastMessage: "",
      toastType: ""
    });

  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    let order = await Order.findById(orderId).populate("userId").lean();
    // BLOCK admin updates for unpaid Razorpay orders
    if (
      order.paymentMethod === "RAZORPAY" &&
      order.paymentStatus !== "Paid"
    ) {
      return res.render("adminOrderDetails", {
        order,
        toastMessage: "Cannot update order status. Online payment not completed.",
        toastType: "error"
      });
    }

    if (!order) {
      return res.render("adminOrderDetails", {
        toastMessage: "Order not found!",
        toastType: "error",
        order: {}
      });
    }

    const oldStatus = order.orderStatus;
    const STATUS_FLOW = [
      "Pending",
      "Processing",
      "Shipped",
      "Out for Delivery",
      "Delivered"
    ];

    const oldIndex = STATUS_FLOW.indexOf(oldStatus);
    const newIndex = STATUS_FLOW.indexOf(status);

    // Rule: If any item is returned or return rejected → block all updates
    if (order.items.some(i => i.status === "Returned" || i.returnStatus === "Rejected")) {
        return res.render("adminOrderDetails", {
            order,
            toastMessage: "Cannot update status after return approval/rejection.",
            toastType: "error"
        });
    }

    // Rule 1: Block backward movement (except Cancelled)
    if (newIndex < oldIndex && status !== "Cancelled") {
      return res.render("adminOrderDetails", {
        order,
        toastMessage: "Cannot select a previous status. Only forward movement allowed.",
        toastType: "error"
      });
    }

    // Rule 2: After Delivered → no changes allowed
    if (oldStatus === "Delivered" && status !== "Delivered") {
      return res.render("adminOrderDetails", {
        order,
        toastMessage: "Delivered orders cannot be updated.",
        toastType: "error"
      });
    }

    // Rule 3: After Cancelled → no changes allowed
    if (oldStatus === "Cancelled" && status !== "Cancelled") {
      return res.render("adminOrderDetails", {
        order,
        toastMessage: "Cancelled orders cannot be updated.",
        toastType: "error"
      });
    }

    // Load order fresh for update (lean() removed above)
    const orderToUpdate = await Order.findById(orderId);

    // Apply status
    orderToUpdate.orderStatus = status;

    // when the status set as delivered => set delivery date (because return item is only possible upto 2 hr from the  time of delivered item)
    if(status === "Delivered"){
      orderToUpdate.deliveryDate = new Date()
    }

    orderToUpdate.items.forEach(item => {
      if (item.status !== "Returned" && item.status !== "Cancelled") {
        item.status = status;
      }
    });

    orderToUpdate.statusHistory.push({
      status,
      comment: "Updated by Admin",
      date: new Date()
    });

    await orderToUpdate.save();

    // Reload updated order for rendering
    const updatedOrder = await Order.findById(orderId).populate("userId").lean();

    return res.render("adminOrderDetails", {
      order: updatedOrder,
      toastMessage: "Status updated successfully!",
      toastType: "success"
    });

  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);
    if (!order) return res.redirect("/admin/orders");

    // Return stock
    for (let item of order.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: item.quantity } }
      );
      item.status = "Cancelled";
    }

    order.orderStatus = "Cancelled";
    order.cancelledAt = new Date();

    order.statusHistory.push({
      status: "Cancelled",
      comment: "Cancelled by Admin",
      date: new Date(),
    });

    recalculateOrderTotals(order);
    await order.save();

    res.redirect("/admin/orders");

  } catch (error) {
    next(error);
  }
};

// APPROVE SINGLE ITEM RETURN
const approveReturnItem = async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.redirect("/admin/orders");

    // Get the specific item
    const item = order.items.id(itemId);
    if (!item) return res.redirect(`/admin/order-details/${orderId}`);

    // Cannot approve if already cancelled
    if (item.status === "Cancelled") {
      return res.redirect(`/admin/order-details/${orderId}`);
    }

    // Mark item as returned
    item.status = "Returned";
    item.returnStatus = "Approved";
    item.returnedAt = new Date();

    // Refund amount = price * qty
    const refundAmount =calculateRefundWithCoupon(order,item);
    //item.refundAmount = item.price * item.quantity;
    item.refundAmount = refundAmount;
    item.refundStatus = "Processed";

    // Increase stock back for that variant
    const product = await Product.findById(item.productId);
    const variant = product.variants.find(v => v.size === item.size);

    if (variant) {
      variant.stock += item.quantity;
      await product.save();
    }

     //WALLET REFUND (ONLY AFTER ADMIN APPROVAL)
    if (order.paymentStatus === "Paid") {
      let wallet = await Wallet.findOne({ userId: order.userId });

      if (!wallet) {
        wallet = await Wallet.create({ userId: order.userId, balance: 0 });
      }

      await wallet.addTransaction({
        type: "refund",
        amount: item.refundAmount,
        orderId: order._id,
        description: `Refund for returned item: ${item.productName}`
      });
    }

    // Push history log
    order.statusHistory.push({
      status: "Item Returned",
      comment: `Returned item: ${item.productName}`,
      date: new Date()
    });
    
    recalculateOrderTotals(order);
    await order.save();

    return res.redirect(`/admin/order-details/${orderId}`);

  } catch (error) {
    next(error);
  }
};

// REJECT SINGLE ITEM RETURN
const rejectReturnItem = async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) return res.redirect("/admin/orders");

    // Get the specific item
    const item = order.items.id(itemId);
    if (!item) return res.redirect(`/admin/order-details/${orderId}`);

    // Update item status
    item.returnStatus = "Rejected";
    item.status = "Delivered"; // return rejected → item stays delivered

    // Log status
    order.statusHistory.push({
      status: "Return Rejected",
      comment: `Return rejected for item: ${item.productName}`,
      date: new Date()
    });

    recalculateOrderTotals(order);
    await order.save();

    return res.redirect(`/admin/order-details/${orderId}`);

  } catch (error) {
    next(error);
  }
};

const loadReturnRequests = async (req, res, next) => {
  try {
    let page = parseInt(req.query.page) || 1;
    const ORDERS_PER_PAGE = 1; 
    const search = req.query.search ? req.query.search.trim() : "";
    const searchRegex = search ? new RegExp(search, "i") : null;
    // 1. Fetch all return request items
    const requests = await Order.aggregate([
      {
        $addFields: {
          totalItemCount: { $size: "$items" }
        }
      },

      { $unwind: "$items" },

      {
        $match: {
          "items.status": "Return Requested"
        }
      },

      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },

      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

      // Optional search
      ...(searchRegex
        ? [
            {
              $match: {
                $or: [
                  { orderId: { $regex: searchRegex } },
                  { "items.productName": { $regex: searchRegex } },
                  { "user.name": { $regex: searchRegex } }
                ]
              }
            }
          ]
        : []),

      {
        $project: {
          orderDbId: "$_id",
          orderId: 1,
          orderDate: 1,
          totalItemCount: 1,
          userName: "$user.name",

          // KEEP ENTIRE ITEM OBJECT
          item: "$items"
        }
      },

      { $sort: { orderDate: -1 } }
    ]);

    // 2.Group items by orderId in Node.js
    let grouped = {};

    requests.forEach(r => {
      if (!grouped[r.orderId]) grouped[r.orderId] = [];
      grouped[r.orderId].push(r);
    });

    // Convert to array format for UI
    let groupedOrders = Object.keys(grouped).map(orderId => {
      const rows = grouped[orderId];

      return {
        orderId,
        first: rows[0],            // top row info
        items: rows,               // all items for this order
      };
    });

    // 3. Apply pagination (AFTER grouping)
    const totalOrders = groupedOrders.length;
    const totalPages = Math.ceil(totalOrders / ORDERS_PER_PAGE);

    const start = (page - 1) * ORDERS_PER_PAGE;
    const paginatedOrders = groupedOrders.slice(start, start + ORDERS_PER_PAGE);

    // 4. Render
    res.render("returnRequests", {
      groupedOrders: paginatedOrders,
      currentPage: page,
      totalPages,
      search
    });

  } catch (error) {
    next(error);
  }
};

const rejectWholeReturn = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);
    if (!order) return res.redirect("/admin/orders");

    // Loop with for..of (await-safe)
    for (const item of order.items) {
      if (item.status === "Return Requested") {
        item.status = "Delivered";          // Item stays delivered
        item.returnStatus = "Rejected";     // Mark return rejection
      }
    }

    order.orderStatus = "Return Rejected";

    order.statusHistory.push({
      status: "Return Rejected",
      comment: "Admin rejected whole return request",
      date: new Date(),
    });

    recalculateOrderTotals(order);
    await order.save();

    res.redirect(`/admin/order-details/${orderId}`);
  } catch (error) {
    next(error);
  }
};

const approveWholeReturn = async (req, res ,next) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);
    if (!order) return res.redirect("/admin/orders");

    let totalRefund = 0;

    // Use for..of so await works correctly
    for (const item of order.items) {
      if (item.status === "Return Requested") {

        item.status = "Returned";
        item.returnStatus = "Approved";
        item.returnedAt = new Date();

        // Refund calculation
        //item.refundAmount = item.price * item.quantity;
        const refundAmount = calculateRefundWithCoupon(order,item);
        item.refundAmount = refundAmount
        item.refundStatus = "Processed";

        totalRefund += refundAmount;

        // Restore product stock
        const product = await Product.findById(item.productId);

        if (product?.variants) {
          const variant = product.variants.find(v => v.size === item.size);
          if (variant) {
            variant.stock += item.quantity;
          }
          await product.save();
        }
      }
    }
    order.orderStatus = "Returned";

    // WALLET REFUND (ONCE FOR FULL ORDER)
    if (order.paymentStatus === "Paid" && totalRefund > 0) {
      let wallet = await Wallet.findOne({ userId: order.userId });

      if (!wallet) {
        wallet = await Wallet.create({ userId: order.userId, balance: 0 });
      }

      await wallet.addTransaction({
        type: "refund",
        amount: totalRefund,
        orderId: order._id,
        description: "Refund for returned order"
      });
    }

    order.statusHistory.push({
      status: "Returned",
      comment: "Admin approved whole order return",
      date: new Date(),
    });

    recalculateOrderTotals(order);
    await order.save();

    res.redirect(`/admin/order-details/${orderId}`);

  } catch (error) {
    next(error);
  }
};

// HELPER: RECALCULATE ORDER TOTALS (ADMIN SIDE)
function recalculateOrderTotals(order) {

  const validItems = order.items.filter(item => {
    if (item.status === "Cancelled") return false;
    if (item.status === "Returned") return false;

    if (
      item.status === "Return Requested" &&
      item.returnStatus === "Approved"
    ) return false;

    if (item.returnStatus === "Rejected") return false;

    return true;
  });

  const subTotal = validItems.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  const taxAmount = Math.round(subTotal * 0.05);
  const shippingCharge = subTotal > 0 ? 50 : 0;
  const offerDiscount = order.offerDiscount || 0;

  order.subTotal = subTotal;
  order.taxAmount = taxAmount;
  order.shippingCharge = shippingCharge;
  order.totalAmount = subTotal + taxAmount + shippingCharge - offerDiscount;
}

function calculateRefundWithCoupon(order,item){
  //No coupon => Full refund (When there is no coupon applied)
  if(!order.couponCode || order.couponDiscount <= 0) {
    return item.price * item.quantity;
  }

  //Total order sum (before returning any item(eg: product1:500,product2:600,total=1100 this total is original subtotal before returning product1 or 2 ))
  const originalSubTotal = order.items.reduce((sum,i)=>{
    return sum+ i.price * i.quantity
  },0);

  //avoid division by 0(avoid problematic situations)
  if(originalSubTotal <=0){
    return item.price * item.quantity;
  }

  //single item total(eg: product price=500 ,quantity:1 => 500*1 =500)
  const itemTotal = item.price*item.quantity;

  //Propotional coupon share
  const couponShare = (itemTotal / originalSubTotal) * order.couponDiscount;

  const refundAmount = itemTotal - couponShare;
  return Math.round(refundAmount)
}

module.exports = {
  loadOrderList,
  loadOrderDetails,
  updateOrderStatus,
  cancelOrder,
  approveReturnItem,
  rejectReturnItem,
  loadReturnRequests,
  rejectWholeReturn,
  approveWholeReturn
};
