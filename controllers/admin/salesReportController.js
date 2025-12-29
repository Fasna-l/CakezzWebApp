const Order = require("../../models/orderSchema");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

/* ===============================
   DATE RANGE HELPER
================================ */
const getDateRange = (range, startDate, endDate) => {
  const now = new Date();
  let from, to;

  switch (range) {
    case "today":
      from = new Date();
      from.setHours(0, 0, 0, 0);
      to = new Date();
      to.setHours(23, 59, 59, 999);
      break;

    case "week":
      from = new Date();
      from.setDate(now.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      to = new Date();
      break;

    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;

    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;

    case "custom":
      from = new Date(startDate);
      from.setHours(0, 0, 0, 0);
      to = new Date(endDate);
      to.setHours(23, 59, 59, 999);
      break;

    default:
      from = new Date(0);
      to = new Date();
  }

  return { from, to };
};

/* ===============================
   LOAD SALES REPORT PAGE
================================ */
const getSalesReport = async (req, res) => {
  try {
    const { page = 1, search, range, startDate, endDate } = req.query;

    const limit = 10;
    const skip = (page - 1) * limit;

    let filter = { orderStatus: "Delivered" };

    // 🔍 Search by Order ID
    if (search) {
      filter.orderId = { $regex: search, $options: "i" };
    }

    // 📅 Date filter
    if (range || (startDate && endDate)) {
      const { from, to } = getDateRange(range, startDate, endDate);
      filter.orderDate = { $gte: from, $lte: to };
    }

    const totalOrders = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalOrders / limit);

    res.render("sales-report", {
      sales: orders,
      currentPage: Number(page),
      totalPages,
      search: search || "",
      range: range || "",
      startDate: startDate || "",
      endDate: endDate || "",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to load sales report");
  }
};

/* ===============================
   EXPORT PDF
================================ */

const exportSalesReportPDF = async (req, res) => {
  const { search, range, startDate, endDate } = req.query;

  let filter = { orderStatus: "Delivered" };

  if (search) {
    filter.orderId = { $regex: search, $options: "i" };
  }

  if (range || (startDate && endDate)) {
    const { from, to } = getDateRange(range, startDate, endDate);
    filter.orderDate = { $gte: from, $lte: to };
  }

  const orders = await Order.find(filter).sort({ orderDate: 1 }).lean();

  /* ===== SUMMARY CALCULATIONS ===== */
  const totalOrders = orders.length;

  const grossSales = orders.reduce((s, o) => s + (o.subTotal || 0), 0);
  const totalDiscount = orders.reduce(
    (s, o) => s + (o.offerDiscount || 0) + (o.couponDiscount || 0),
    0
  );

  const netRevenue = orders.reduce((s, o) => {
    return (
      s +
      (o.paymentMethod === "COD"
        ? o.totalAmount || 0
        : o.payableAmount || o.totalAmount || 0)
    );
  }, 0);

  const avgOrderValue = totalOrders ? netRevenue / totalOrders : 0;

  /* ===== PDF SETUP ===== */
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");

  doc.pipe(res);

  /* ===== TITLE ===== */
  doc.fontSize(20).text("Sales Report", { align: "center" });
  doc.moveDown(0.5);

  doc
    .fontSize(11)
    .text(
      `Period: ${
        startDate || "Beginning"
      } - ${endDate || new Date().toLocaleDateString()}`,
      { align: "center" }
    );

  doc.moveDown(1.5);

  /* ===== SUMMARY ===== */
  doc.fontSize(14).text("Summary", { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11);
  doc.text(`Total Orders: ${totalOrders}`);
  doc.text(`Gross Sales: ₹${grossSales.toFixed(2)}`);
  doc.text(`Total Discounts: ₹${totalDiscount.toFixed(2)}`);
  doc.text(`Net Revenue: ₹${netRevenue.toFixed(2)}`);
  doc.text(`Average Order Value: ₹${avgOrderValue.toFixed(2)}`);

  doc.moveDown(1.5);

  /* ===== TABLE HEADER ===== */
  const tableTop = doc.y;
  const rowHeight = 20;

  doc.fontSize(11).font("Helvetica-Bold");

  doc.text("Order ID", 40, tableTop);
  doc.text("Date", 130, tableTop);
  doc.text("Subtotal", 200, tableTop);
  doc.text("Discount", 280, tableTop);
  doc.text("Final Amount", 360, tableTop);
  doc.text("Payment", 460, tableTop);
  doc.text("Status", 530, tableTop);

  doc.moveTo(40, tableTop + 15).lineTo(570, tableTop + 15).stroke();

  /* ===== TABLE ROWS ===== */
  doc.font("Helvetica");

  let y = tableTop + rowHeight;

  orders.forEach((o) => {
    const paid =
      o.paymentMethod === "COD"
        ? o.totalAmount || 0
        : o.payableAmount || o.totalAmount || 0;

    if (y > 760) {
      doc.addPage();
      y = 40;
    }

    doc.text(o.orderId, 40, y);
    doc.text(new Date(o.orderDate).toLocaleDateString(), 130, y);
    doc.text(`₹${(o.subTotal || 0).toFixed(2)}`, 200, y);
    doc.text(
      `₹${((o.offerDiscount || 0) + (o.couponDiscount || 0)).toFixed(2)}`,
      280,
      y
    );
    doc.text(`₹${paid.toFixed(2)}`, 360, y);
    doc.text(o.paymentMethod, 460, y);
    doc.text(o.orderStatus, 530, y);

    y += rowHeight;
  });

  doc.end();
};

/* ===============================
   EXPORT EXCEL
================================ */
const exportSalesReportExcel = async (req, res) => {
  const { search, range, startDate, endDate } = req.query;

  let filter = { orderStatus: "Delivered" };

  if (search) {
    filter.orderId = { $regex: search, $options: "i" };
  }

  if (range || (startDate && endDate)) {
    const { from, to } = getDateRange(range, startDate, endDate);
    filter.orderDate = { $gte: from, $lte: to };
  }

  const orders = await Order.find(filter).sort({ orderDate: -1 }).lean();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sales Report");

  sheet.addRow([
    "Order ID",
    "Order Date",
    "Payment",
    "Subtotal",
    "Discount",
    "Paid Amount",
    "Status",
  ]);

  orders.forEach((o) => {
    const paid =
      o.paymentMethod === "COD"
        ? o.totalAmount || 0
        : o.payableAmount || o.totalAmount || 0;

    sheet.addRow([
      o.orderId,
      new Date(o.orderDate).toLocaleDateString(),
      o.paymentMethod,
      o.subTotal || 0,
      (o.offerDiscount || 0) + (o.couponDiscount || 0),
      paid,
      o.orderStatus,
    ]);
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=sales-report.xlsx"
  );

  await workbook.xlsx.write(res);
  res.end();
};

module.exports = {
  getSalesReport,
  exportSalesReportPDF,
  exportSalesReportExcel,
};

