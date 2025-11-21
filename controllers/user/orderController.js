const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const PDFDocument = require("pdfkit");

/* --------------------------------------------------------
   1. LOAD ORDER LIST PAGE (Search + Pagination)
---------------------------------------------------------*/
const loadOrderList = async (req, res) => {
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

    res.render("orderList", {
      orders,
      pagination,
      q: search
    });

  } catch (error) {
    console.error("loadOrderList error:", error);
    res.redirect("/pageNotFound");
  }
};


/* --------------------------------------------------------
   2. LOAD ORDER DETAILS PAGE
---------------------------------------------------------*/
const loadOrderDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;

    const order = await Order.findById(orderId);

    if (!order || order.userId.toString() !== userId.toString()) {
      return res.redirect("/order");
    }

    res.render("orderDetails", { order });

  } catch (error) {
    console.error("loadOrderDetails error:", error);
    res.redirect("/pageNotFound");
  }
};


/* --------------------------------------------------------
   3. SHOW CANCEL PAGE (Optional Reason)
---------------------------------------------------------*/
const loadCancelPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;
    const itemId = req.query.item || null;

    const order = await Order.findById(orderId);

    if (!order || order.userId.toString() !== userId.toString()) {
      return res.redirect("/order");
    }

    // If already cancelled/delivered → cannot cancel
    if (order.orderStatus === "Cancelled" || order.orderStatus === "Delivered") {
      return res.redirect(`/order/${orderId}`);
    }

    // Pass itemId to EJS
    res.render("cancelOrder", { order, itemId });

  } catch (error) {
    console.error("loadCancelPage error:", error);
    res.redirect("/pageNotFound");
  }
};



// /* --------------------------------------------------------
//    4. CANCEL ENTIRE ORDER + INCREASE STOCK
// ---------------------------------------------------------*/

const cancelOrder = async (req, res) => {
  try {
    const { reason, itemId } = req.body;
    const orderId = req.params.id;
    const userId = req.session.user;

    const order = await Order.findById(orderId);

    if (!order || order.userId.toString() !== userId.toString()) {
      return res.redirect("/order");
    }

    // -------------------------------
    // CANCEL SINGLE ITEM
    // -------------------------------
    if (itemId) {
      const item = order.items.id(itemId);
      if (!item) return res.redirect(`/order/${orderId}`);

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

      // Required because items is nested
      order.markModified("items");

      // Check if ALL items are cancelled
      const allCancelled = order.items.every(it => it.status === "Cancelled");

      if (allCancelled) {
        order.orderStatus = "Cancelled";
        order.cancellationReason = reason || "No reason provided";
        order.cancelledAt = new Date();

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

    // -------------------------------
    // CANCEL FULL ORDER
    // -------------------------------
    else {
      for (let it of order.items) {
        const product = await Product.findById(it.productId);
        const variant = product.variants.find(v => v.size === it.size);
        if (variant) {
          variant.stock += it.quantity;
          await product.save();
        }

        it.status = "Cancelled";
      }

      order.orderStatus = "Cancelled";
      order.cancellationReason = reason || "No reason provided";
      order.cancelledAt = new Date();

      order.statusHistory.push({
        status: "Order Cancelled",
        comment: reason,
        date: new Date()
      });
    }

    recalculateOrderTotals(order);
    await order.save();
    return res.redirect(`/order/${orderId}`);

  } catch (error) {
    console.error("cancelOrder error:", error);
    return res.redirect("/pageNotFound");
  }
};



/* --------------------------------------------------------
   6. RETURN ORDER (Delivered Only) + Mandatory Reason
---------------------------------------------------------*/
const loadReturnPage = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    res.render("returnOrder", { order });
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

const submitReturnRequest = async (req, res) => {
  try {
    const orderId = req.params.id;
    const reason = req.body.reason;

    if (!reason || reason.trim() === "") {
      return res.send("Reason is required");
    }

    const order = await Order.findById(orderId);

    if (!order) return res.redirect("/order");

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

    res.redirect(`/order/${orderId}`);

  } catch (error) {
    console.error("submitReturnRequest error:", error);
    res.redirect("/pageNotFound");
  }
};


/* --------------------------------------------------------
   7. DOWNLOAD INVOICE PDF
---------------------------------------------------------*/
const downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    const user = await User.findById(order.userId).lean();

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_${order.orderId}.pdf`
    );

    doc.pipe(res);

    /* ---------------------------------------------------------
       HEADER
    ---------------------------------------------------------*/
    doc.fontSize(26).text("Cakez.in", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(16).text("Invoice", { align: "center" });
    doc.moveDown(1.2);

    /* ---------------------------------------------------------
       CUSTOMER DETAILS
    ---------------------------------------------------------*/
    doc.fontSize(14).text("Customer Details", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(12).text(`Name: ${user.name || "N/A"}`);
    doc.text(`Email: ${user.email || "N/A"}`);
    doc.moveDown(1);

    /* ---------------------------------------------------------
       SHIPPING ADDRESS
    ---------------------------------------------------------*/
    const s = order.shippingAddress;

    doc.fontSize(14).text("Shipping Address", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(12).text(
      `${s.streetAddress}, ${s.city}, ${s.district}, ${s.state} - ${s.pinCode}`
    );
    doc.text(`Phone: ${s.phoneNumber}`);
    doc.moveDown(1);

    /* ---------------------------------------------------------
       INVOICE DETAILS
    ---------------------------------------------------------*/
    doc.fontSize(14).text("Invoice Details", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(12).text(`Invoice Number: ${order.orderId}`);
    doc.text(`Invoice Date: ${order.orderDate.toLocaleDateString("en-GB")}`);
    doc.text(`Payment Method: ${order.paymentMethod}`);
    doc.moveDown(1);

    /* ---------------------------------------------------------
       TABLE HEADER
    ---------------------------------------------------------*/
    const tableTop = doc.y;

    doc.fontSize(13).text("Item Name", 50, tableTop);
    doc.text("Qty", 260, tableTop);
    doc.text("Status", 310, tableTop);
    doc.text("Unit Price", 400, tableTop);
    doc.text("Subtotal", 500, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
    doc.moveDown();

    /* ---------------------------------------------------------
       TABLE ROWS
    ---------------------------------------------------------*/
    order.items.forEach(item => {
      const y = doc.y;

      const subtotal = item.price * item.quantity;

      doc.fontSize(12).text(item.productName, 50, y);
      doc.text(item.quantity.toString(), 260, y);
      doc.text(item.status, 310, y);
      doc.text(`₹${item.price}`, 400, y);
      doc.text(`₹${subtotal}`, 500, y);

      doc.moveDown(0.7);
    });

    doc.moveDown(1);

    /* ---------------------------------------------------------
       PAYMENT SUMMARY RIGHT ALIGNED
    ---------------------------------------------------------*/
    // doc.fontSize(14).text("Payment Summary", 350, doc.y, { underline: true });
    doc.moveDown(0.5);
  //   doc.fontSize(14)
  //  .text("Payment Summary", 420, doc.y, {
  //    align: "left",
  //    underline: true
  //  });
  const rightX = doc.page.width - 180; // shift heading right
  doc.fontSize(14).text("Payment Summary", rightX, doc.y, {
  underline: true
  });

   doc.moveDown(0.5);


    doc.fontSize(12).text(`Subtotal: ₹${order.subTotal}`, { align: "right" });
    doc.text(`Tax: ₹${order.taxAmount}`, { align: "right" });
    doc.text(`Shipping Charge: ₹${order.shippingCharge}`, { align: "right" });
    doc.text(`Discount: ₹${order.offerDiscount}`, { align: "right" });

    doc.moveDown(0.7);

    doc.fontSize(14).text(`Grand Total: ₹${order.totalAmount}`, {
      align: "right",
    });

    /* ---------------------------------------------------------
       FOOTER (BOTTOM RIGHT)
    ---------------------------------------------------------*/
    doc.moveDown(3);

    doc.fontSize(11).text(
      "Thank you for shopping with Cakez.in!",
      0,                     // start at left edge
      doc.y,                 // current Y position
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
    console.error("downloadInvoice error:", error);
    res.redirect("/pageNotFound");
  }
};

const loadSingleReturnPage = async (req, res) => {
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

    res.render("return-Singleitem", { order, item });

  } catch (error) {
    console.error("loadSingleReturnPage error:", error);
    res.redirect("/pageNotFound");
  }
};

const submitSingleReturn = async (req, res) => {
  try {
    const userId = req.session.user;
    const { orderId, itemId } = req.params;
    const reason = req.body.reason;

    if (!reason || reason.trim() === "") {
      return res.send("Reason is required");
    }

    const order = await Order.findById(orderId);
    if (!order || order.userId.toString() !== userId.toString()) {
      return res.redirect("/order");
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

    res.redirect(`/order/${orderId}`);

  } catch (error) {
    console.error("submitSingleReturn error:", error);
    res.redirect("/pageNotFound");
  }
};

/* --------------------------------------------------------
   HELPER: RECALCULATE ORDER TOTALS
---------------------------------------------------------*/
function recalculateOrderTotals(order) {

  // Include only ACTIVE items (exclude cancelled/returned)
  const validItems = order.items.filter(
    item =>
      item.status !== "Cancelled" &&
      item.status !== "Returned"
  );

  // SUBTOTAL
  const subTotal = validItems.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  // TAX (5%)
  const taxAmount = Math.round(subTotal * 0.05);

  // SHIPPING: always 50 if subtotal > 0
  const shippingCharge = subTotal > 0 ? 50 : 0;
  // No offers in your system
  const offerDiscount = 0;

  // FINAL TOTAL
  const totalAmount = subTotal + taxAmount + shippingCharge;

  // Apply back to order object
  order.subTotal = subTotal;
  order.taxAmount = taxAmount;
  order.shippingCharge = shippingCharge;
  order.offerDiscount = offerDiscount;
  order.totalAmount = totalAmount;

  return order;
}


/* --------------------------------------------------------
   EXPORT FUNCTIONS
---------------------------------------------------------*/
module.exports = {
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
