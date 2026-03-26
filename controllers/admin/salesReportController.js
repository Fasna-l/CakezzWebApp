import Order from "../../models/orderSchema.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import HTTP_STATUS from "../../utils/httpStatus.js";
import RESPONSE_MESSAGES from "../../utils/responseMessages.js";
import logger from "../../utils/logger.js";

//DATE RANGE HELPER
const getDateRange = (range, startDate, endDate) => {
  const now = new Date();
  let from, to;

  switch (range) {
    case "today": from = new Date(); from.setHours(0, 0, 0, 0); to = new Date(); to.setHours(23, 59, 59, 999); break;
    case "week": from = new Date(now - 7 * 24 * 60 * 60 * 1000); from.setHours(0, 0, 0, 0); to = new Date(); break;
    case "month": from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); break;
    case "year": from = new Date(now.getFullYear(), 0, 1); to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999); break;
    case "custom": from = new Date(startDate); from.setHours(0, 0, 0, 0); to = new Date(endDate); to.setHours(23, 59, 59, 999); break;
    default: from = new Date(0); to = new Date();
  }

  return { from, to };
};

const getSalesReport = async (req, res, next) => {
  try {
    const { page = 1, search, range, startDate, endDate, status } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    let filter = {
      $or: [
        { paymentMethod: "COD", orderStatus: "Delivered" },
        { paymentMethod: { $ne: "COD" }, paymentStatus: "Paid" }
      ]
    };
    if (status) filter.orderStatus = status;
    if (search) filter.orderId = { $regex: search, $options: "i" };
    if (startDate && endDate) {
      const from = new Date(startDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(endDate);
      to.setHours(23, 59, 59, 999);
      filter.orderDate = { $gte: from, $lte: to };
    } else if (range) {
      const { from, to } = getDateRange(range);
      filter.orderDate = { $gte: from, $lte: to };
    }


    const totalOrders = await Order.countDocuments(filter);
    const orders = await Order.find(filter).sort({ orderDate: -1 }).skip(skip).limit(limit).lean();
    const totalPages = Math.ceil(totalOrders / limit);

    logger.info(
      `ADMIN VIEW SALES REPORT | Page: ${page} | Range: ${range || "custom"}`
    );

    res.render("sales-report", {
      sales: orders,
      currentPage: Number(page),
      totalPages,
      search: search || "",
      range: range || "",
      startDate: startDate || "",
      endDate: endDate || "",
      status: status || "",
    });

  } catch (error) {
    next(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
      RESPONSE_MESSAGES.SALES_REPORT_LOAD_FAILED
    );
  }
};

const exportSalesReportExcel = async (req, res) => {
  const { search, range, startDate, endDate, status } = req.query;
  let filter = {
    $or: [
      { paymentMethod: "COD", orderStatus: "Delivered" },
      { paymentMethod: { $ne: "COD" }, paymentStatus: "Paid" }
    ]
  };

  if (status) filter.orderStatus = status;
  if (search) filter.orderId = { $regex: search, $options: "i" };
  if (startDate && endDate) {
    const from = new Date(startDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(endDate);
    to.setHours(23, 59, 59, 999);
    filter.orderDate = { $gte: from, $lte: to };
  } else if (range) {
    const { from, to } = getDateRange(range);
    filter.orderDate = { $gte: from, $lte: to };
  }

  const orders = await Order.find(filter).sort({ orderDate: -1 }).lean();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sales Report");

  sheet.addRow(["Order ID", "Order Date", "Payment", "Subtotal", "Discount", "Paid Amount", "Status"]);

  orders.forEach(o => {
    const paid = o.paymentMethod === "COD" ? o.totalAmount || 0 : o.payableAmount || o.totalAmount || 0;
    sheet.addRow([
      o.orderId,
      new Date(o.orderDate).toLocaleDateString(),
      o.paymentMethod,
      Number(o.subTotal || 0),
      Number((o.offerDiscount || 0) + (o.couponDiscount || 0)),
      Number(paid),
      o.orderStatus,
    ]);
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=sales-report.xlsx");
  logger.info(
    `ADMIN EXPORT SALES REPORT EXCEL | Range: ${range || "custom"}`
  );
  await workbook.xlsx.write(res);
  res.end();
};

const exportSalesReportPDF = async (req, res) => {
  const { search, range, startDate, endDate, status } = req.query;
  let filter = {
    $or: [
      { paymentMethod: "COD", orderStatus: "Delivered" },
      { paymentMethod: { $ne: "COD" }, paymentStatus: "Paid" }
    ]
  };

  if (status) filter.orderStatus = status;
  if (search) filter.orderId = { $regex: search, $options: "i" };
  if (startDate && endDate) {
    const from = new Date(startDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(endDate);
    to.setHours(23, 59, 59, 999);
    filter.orderDate = { $gte: from, $lte: to };
  } else if (range) {
    const { from, to } = getDateRange(range);
    filter.orderDate = { $gte: from, $lte: to };
  }


  const orders = await Order.find(filter).sort({ orderDate: -1 }).lean();  // pdf shows latest data first

  logger.info(
    `ADMIN EXPORT SALES REPORT PDF | Range: ${range || "custom"}`
  );

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");
  doc.pipe(res);
  //  Title Section
  doc.fontSize(18).font("Helvetica-Bold").text("Sales Report", { align: "center" });
  doc.moveDown(0.5);

  const periodFrom = startDate ? formatDate(startDate) : "Start";
  const periodTo = endDate ? formatDate(endDate) : formatDate(new Date());
  doc.fontSize(10).font("Helvetica")
    .text(`Period: ${periodFrom} - ${periodTo}`, { align: "center" });
  doc.moveDown(1);
  //  Summary Calculations
  const totalOrders = orders.length;

  let grossSales = 0;
  let totalCouponDiscount = 0;
  let netRevenue = 0;

  const paymentSummary = {};

  orders.forEach(o => {
    const subtotal = o.subTotal || 0;
    const couponDiscount = o.couponDiscount || 0;
    const finalAmount = subtotal - couponDiscount;

    grossSales += subtotal;
    totalCouponDiscount += couponDiscount;
    netRevenue += finalAmount;

    if (!paymentSummary[o.paymentMethod]) {
      paymentSummary[o.paymentMethod] = { count: 0, total: 0 };
    }
    paymentSummary[o.paymentMethod].count += 1;
    paymentSummary[o.paymentMethod].total += finalAmount;
  });

  const avgOrderValue = totalOrders ? netRevenue / totalOrders : 0;
  //  Summary Section Output
  doc.font("Helvetica-Bold").fontSize(12).text("Summary");
  doc.moveDown(0.5);

  doc.fontSize(10).font("Helvetica").text(`Total Orders: ${totalOrders}`);
  doc.text(`Gross Sales: Rs.${grossSales.toFixed(2)}`);
  doc.text(`Total Discounts: Rs.${totalCouponDiscount.toFixed(2)}`);
  doc.text(`Net Revenue: Rs.${netRevenue.toFixed(2)}`);
  doc.text(`Average Order Value: Rs.${avgOrderValue.toFixed(2)}`);
  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").text("Payment Methods:");
  doc.font("Helvetica");
  Object.keys(paymentSummary).forEach(method => {
    doc.text(`- ${method}: ${paymentSummary[method].count} orders (Rs.${paymentSummary[method].total.toFixed(2)})`);
  });

  doc.moveDown(1.5);
  //  Detailed Table Header
  doc.font("Helvetica-Bold").fontSize(12).text("Detailed Sales Data");
  doc.moveDown(0.5);

  const tableTop = doc.y;
  const rowHeight = 20;

  doc.fontSize(10).font("Helvetica-Bold");
  doc.text("Order ID", 40, tableTop);
  doc.text("Date", 140, tableTop);
  doc.text("Subtotal", 210, tableTop);
  doc.text("Discount", 280, tableTop);
  doc.text("Final Amount", 350, tableTop);
  doc.text("Payment", 440, tableTop);
  doc.text("Status", 510, tableTop);

  doc.moveTo(40, tableTop + 15).lineTo(570, tableTop + 15).stroke();
  doc.font("Helvetica");

  //  Detailed Table Rows
  let y = tableTop + rowHeight;

  orders.forEach(o => {
    const subtotal = o.subTotal || 0;
    const couponDiscount = o.couponDiscount || 0;
    const finalAmount = subtotal - couponDiscount;

    if (y > 750) {
      doc.addPage();
      y = 40;
    }

    doc.fontSize(9).text(o.orderId, 40, y);
    doc.text(formatDate(o.orderDate), 140, y);
    doc.text(`Rs.${subtotal.toFixed(2)}`, 210, y);
    doc.text(`Rs.${couponDiscount.toFixed(2)}`, 280, y);
    doc.text(`Rs.${finalAmount.toFixed(2)}`, 350, y);
    doc.text(o.paymentMethod, 440, y);
    doc.text(o.orderStatus, 510, y);

    y += rowHeight;
  });

  doc.end();
};

// Helper: Format Date
function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default {
  getSalesReport,
  exportSalesReportExcel,
  exportSalesReportPDF
};

