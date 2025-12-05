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
// const loadOrderDetails = async (req, res) => {
//   try {
//     const orderId = req.params.id;

//     const order = await Order.findById(orderId).populate("userId").lean();

//     if (!order) return res.redirect("/admin/orders");

//     //  Correct render path (NO admin/)
//     res.render("adminOrderDetails", { order });

//   } catch (err) {
//     console.log("loadOrderDetails error:", err);
//     res.redirect("/admin/pageerror");
//   }
// };

const loadOrderDetails = async (req, res) => {
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

    // Always send defaults to avoid undefined errors
    res.render("adminOrderDetails", {
      order,
      toastMessage: "",
      toastType: ""
    });

  } catch (err) {
    console.log("loadOrderDetails error:", err);

    res.render("adminOrderDetails", {
      order: {},
      toastMessage: "Something went wrong!",
      toastType: "error"
    });
  }
};


/* ================================================================
   3. UPDATE ORDER STATUS (admin)
================================================================ */
// const updateOrderStatus = async (req, res) => {
//   try {
//     const orderId = req.params.id;
//     const { status } = req.body;

//     const order = await Order.findById(orderId);

//     if (!order) return res.redirect("/admin/orders");

//     // Update main order status
//     order.orderStatus = status;

//     // ALSO UPDATE EACH ITEM STATUS
//     order.items.forEach(item => {
//       if (item.status !== "Cancelled") {
//         item.status = status;
//       }
//     });

//     // Add status history
//     order.statusHistory.push({
//       status,
//       comment: "Updated by Admin",
//       date: new Date(),
//     });

//     await order.save();

//     res.redirect(`/admin/order-details/${orderId}`);

//   } catch (err) {
//     console.log("updateOrderStatus error:", err);
//     res.redirect("/admin/pageerror");
//   }
// };

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    let order = await Order.findById(orderId).populate("userId").lean();
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

    // ❌ Rule: If any item is returned or return rejected → block all updates
    if (order.items.some(i => i.status === "Returned" || i.returnStatus === "Rejected")) {
        return res.render("adminOrderDetails", {
            order,
            toastMessage: "Cannot update status after return approval/rejection.",
            toastType: "error"
        });
    }


    // ❌ Rule 1: Block backward movement (except Cancelled)
    if (newIndex < oldIndex && status !== "Cancelled") {
      return res.render("adminOrderDetails", {
        order,
        toastMessage: "Cannot select a previous status. Only forward movement allowed.",
        toastType: "error"
      });
    }

    // ❌ Rule 2: After Delivered → no changes allowed
    if (oldStatus === "Delivered" && status !== "Delivered") {
      return res.render("adminOrderDetails", {
        order,
        toastMessage: "Delivered orders cannot be updated.",
        toastType: "error"
      });
    }

    // ❌ Rule 3: After Cancelled → no changes allowed
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

  } catch (err) {
    console.error("updateOrderStatus error:", err);
    
    return res.render("adminOrderDetails", {
      toastMessage: "An error occurred while updating status.",
      toastType: "error",
      order: {}
    });
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

// APPROVE SINGLE ITEM RETURN
const approveReturnItem = async (req, res) => {
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
    item.refundAmount = item.price * item.quantity;
    item.refundStatus = "Processed";

    // Increase stock back for that variant
    const product = await Product.findById(item.productId);
    const variant = product.variants.find(v => v.size === item.size);

    if (variant) {
      variant.stock += item.quantity;
      await product.save();
    }

    // Push history log
    order.statusHistory.push({
      status: "Item Returned",
      comment: `Returned item: ${item.productName}`,
      date: new Date()
    });

    await order.save();

    return res.redirect(`/admin/order-details/${orderId}`);

  } catch (err) {
    console.error("approveReturnItem error:", err);
    return res.redirect("/pageNotFound");
  }
};

// REJECT SINGLE ITEM RETURN
const rejectReturnItem = async (req, res) => {
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

    await order.save();

    return res.redirect(`/admin/order-details/${orderId}`);

  } catch (err) {
    console.error("rejectReturnItem error:", err);
    return res.redirect("/pageNotFound");
  }
};

// const loadReturnRequests = async (req, res) => {
//   try {
//     let page = parseInt(req.query.page) || 1;
//     const limit = 3; 
//     const skip = (page - 1) * limit;
//     const search = req.query.search ? req.query.search.trim() : "";

//     // Build search regex if present
//     const searchRegex = search ? new RegExp(search, "i") : null;

//     // Aggregation pipeline:
//     const pipeline = [
//       {
//         $addFields: {
//         totalItemCount: { $size: "$items" }   // ADD THIS BEFORE UNWIND
//         }
//       },
//       { $unwind: "$items" },
//       { $match: { "items.status": "Return Requested" } },

//       // lookup user to get name
//       {
//         $lookup: {
//           from: "users",
//           localField: "userId",
//           foreignField: "_id",
//           as: "user"
//         }
//       },
//       { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

//       // Optionally filter by search across orderId, productName, user.name
//       ...(searchRegex ? [
//         {
//           $match: {
//             $or: [
//               { orderId: { $regex: searchRegex } },
//               { "items.productName": { $regex: searchRegex } },
//               { "user.name": { $regex: searchRegex } }
//             ]
//           }
//         }
//       ] : []),

//       // Project fields we need in the table
//       {
//         $project: {
//           orderId: 1,
//           orderDbId: "$_id",
//           orderDate: 1,
//           totalItemCount: 1,
//           "item._id": "$items._id",
//           "item.productId": "$items.productId",
//           "item.productName": "$items.productName",
//           "item.productImage": "$items.productImage",
//           "item.size": "$items.size",
//           "item.price": "$items.price",
//           "item.quantity": "$items.quantity",
//           "item.status": "$items.status",
//           "item.returnStatus": "$items.returnStatus",
//           userName: "$user.name",
//         }
//       },

//       { $sort: { orderDate: -1 } },

//       // Facet to get total count + paginated data
//       {
//         $facet: {
//           metadata: [{ $count: "total" }],
//           data: [{ $skip: skip }, { $limit: limit }]
//         }
//       }
//     ];

//     const aggResult = await Order.aggregate(pipeline);

//     const total = (aggResult[0].metadata[0] && aggResult[0].metadata[0].total) || 0;
//     const rows = (aggResult[0].data || []).map(r => ({
//       orderDbId: r.orderDbId,
//       orderId: r.orderId,
//       orderDate: r.orderDate,
//       itemId: r.item._id,
//       totalItemCount: r.totalItemCount,
//       productId: r.item.productId,
//       productName: r.item.productName,
//       productImage: r.item.productImage,
//       size: r.item.size,
//       price: r.item.price,
//       quantity: r.item.quantity,
//       status: r.item.status,
//       returnStatus: r.item.returnStatus,
//       userName: r.userName || "Unknown"
//     }));

//     const totalPages = Math.ceil(total / limit);

//     res.render("returnRequests", {
//       requests: rows,
//       currentPage: page,
//       totalPages,
//       search
//     });

//   } catch (err) {
//     console.error("loadReturnRequests error:", err);
//     res.redirect("/admin/pageerror");
//   }
// };

const loadReturnRequests = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    const ORDERS_PER_PAGE = 2; // Show 2 orders per page
    const search = req.query.search ? req.query.search.trim() : "";

    const searchRegex = search ? new RegExp(search, "i") : null;

    // 1️⃣ Fetch all return request items
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

    // 2️⃣ Group items by orderId in Node.js
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

    // 3️⃣ Apply pagination (AFTER grouping)
    const totalOrders = groupedOrders.length;
    const totalPages = Math.ceil(totalOrders / ORDERS_PER_PAGE);

    const start = (page - 1) * ORDERS_PER_PAGE;
    const paginatedOrders = groupedOrders.slice(start, start + ORDERS_PER_PAGE);

    // 4️⃣ Render
    res.render("returnRequests", {
      groupedOrders: paginatedOrders,
      currentPage: page,
      totalPages,
      search
    });

  } catch (err) {
    console.error("loadReturnRequests error:", err);
    res.redirect("/admin/pageerror");
  }
};

// const rejectWholeReturn = async (req, res) => {
//   try {
//     const orderId = req.params.id;

//     const order = await Order.findById(orderId);
//     if (!order) return res.redirect("/admin/orders");

//     order.items.forEach(item => {
//       if (item.status === "Return Requested") {
//         item.status = "Delivered";
//         item.returnStatus = "Rejected";
//       }
//     });

//     order.orderStatus = "Return Rejected";

//     order.statusHistory.push({
//       status: "Return Rejected",
//       comment: "Admin rejected whole return request",
//       date: new Date(),
//     });

//     order.markModified("items");
//     await order.save();

//     res.redirect(`/admin/order-details/${orderId}`);
//   } catch (error) {
//     console.error("rejectWholeReturn error:", error);
//     res.redirect("/admin/pageerror");
//   }
// };

// const approveWholeReturn = async (req, res) => {
//   try {
//     const orderId = req.params.id;

//     const order = await Order.findById(orderId);
//     if (!order) return res.redirect("/admin/orders");

//     order.items.forEach(item => {
//       if (item.status === "Return Requested") {
//         item.status = "Returned";
//         item.returnStatus = "Approved";
//         item.refundAmount = item.price * item.quantity;
//         item.refundStatus = "Processed";
//       }
//     });

//     order.orderStatus = "Returned";

//     order.statusHistory.push({
//       status: "Returned",
//       comment: "Admin approved whole order return",
//       date: new Date(),
//     });

//     await order.save();

//     res.redirect(`/admin/order-details/${orderId}`);

//   } catch (error) {
//     console.error("approveWholeReturn error:", error);
//     res.redirect("/admin/pageerror");
//   }
// };

const rejectWholeReturn = async (req, res) => {
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

    await order.save();

    res.redirect(`/admin/order-details/${orderId}`);
  } catch (error) {
    console.error("rejectWholeReturn error:", error);
    res.redirect("/admin/pageerror");
  }
};

const approveWholeReturn = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId);
    if (!order) return res.redirect("/admin/orders");

    // Use for..of so await works correctly
    for (const item of order.items) {
      if (item.status === "Return Requested") {

        item.status = "Returned";
        item.returnStatus = "Approved";
        item.returnedAt = new Date();

        // Refund calculation
        item.refundAmount = item.price * item.quantity;
        item.refundStatus = "Processed";

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

    order.statusHistory.push({
      status: "Returned",
      comment: "Admin approved whole order return",
      date: new Date(),
    });

    await order.save();

    res.redirect(`/admin/order-details/${orderId}`);

  } catch (error) {
    console.error("approveWholeReturn error:", error);
    res.redirect("/admin/pageerror");
  }
};



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
