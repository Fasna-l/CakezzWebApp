(function () {
  const applyBtn = document.getElementById("applyFilter");
  if (!applyBtn) return; // prevents running on other pages

  applyBtn.addEventListener("click", loadReport);

  function buildQuery() {
    const range = document.getElementById("range")?.value || "";
    const startDate = document.getElementById("startDate")?.value || "";
    const endDate = document.getElementById("endDate")?.value || "";
    return `range=${range}&startDate=${startDate}&endDate=${endDate}`;
  }

  async function loadReport() {
    const res = await fetch(`/admin/sales-report/data?${buildQuery()}`);
    const data = await res.json();

    document.getElementById("totalOrders").innerText =
      data.summary.totalOrders;
    document.getElementById("grossSales").innerText =
      "₹" + data.summary.grossSales;
    document.getElementById("totalDiscounts").innerText =
      "₹" + data.summary.totalDiscounts;
    document.getElementById("netRevenue").innerText =
      "₹" + data.summary.netRevenue;

    document.getElementById("pdfBtn").href =
      `/admin/sales-report/pdf?${buildQuery()}`;
    document.getElementById("excelBtn").href =
      `/admin/sales-report/excel?${buildQuery()}`;
  }
})();
