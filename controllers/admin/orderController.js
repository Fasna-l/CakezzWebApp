const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");

/* ================================================================
   1. LOAD ORDER LIST (Search + Filter + Pagination)
================================================================ */
const loadOrderList = async (req, res) => {
  try {
    let {
      page = 1,
      search = "",
      status = "",
    } = req.query;

    page = parseInt(page) || 1;
    const limit = 10;
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


    // 🔥 Correct render path (NO admin/)
    res.render("adminOrderList", {
      orders: formattedOrders,
      search,
      currentPage: page,
      totalPages,
    });

  } catch (err) {
    console.log("admin loadOrderList error:", err);
    res.redirect("/admin/pageerror");
  }
};


/* ================================================================
   2. LOAD ORDER DETAILS PAGE
================================================================ */
const loadOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId).populate("userId").lean();

    if (!order) return res.redirect("/admin/orders");

    // 🔥 Correct render path (NO admin/)
    res.render("adminOrderDetails", { order });

  } catch (err) {
    console.log("loadOrderDetails error:", err);
    res.redirect("/admin/pageerror");
  }
};


/* ================================================================
   3. UPDATE ORDER STATUS (admin)
================================================================ */
const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    const order = await Order.findById(orderId);

    if (!order) return res.redirect("/admin/orders");

    // Update main order status
    order.orderStatus = status;

    // ALSO UPDATE EACH ITEM STATUS
    order.items.forEach(item => {
      if (item.status !== "Cancelled") {
        item.status = status;
      }
    });

    // Add status history
    order.statusHistory.push({
      status,
      comment: "Updated by Admin",
      date: new Date(),
    });

    await order.save();

    res.redirect(`/admin/order-details/${orderId}`);

  } catch (err) {
    console.log("updateOrderStatus error:", err);
    res.redirect("/admin/pageerror");
  }
};



/* ================================================================
   4. CANCEL ORDER (Admin Side)
================================================================ */
const cancelOrder = async (req, res) => {
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

    await order.save();

    res.redirect("/admin/orders");

  } catch (err) {
    console.log("admin cancelOrder error:", err);
    res.redirect("/admin/pageerror");
  }
};


module.exports = {
  loadOrderList,
  loadOrderDetails,
  updateOrderStatus,
  cancelOrder,
};
