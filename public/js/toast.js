function showToast(message, type = "success") {
  const container = document.querySelector(".toast-container") ||
    (() => {
      const div = document.createElement("div");
      div.className = "toast-container";
      document.body.appendChild(div);
      return div;
    })();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

//   let icon = "✔️";
//   if (type === "error") icon = "❌";
//   if (type === "warning") icon = "⚠️";
let icon = '<i class="fas fa-check"></i>';
if (type === "error") icon = '<i class="fas fa-times"></i>';
if (type === "warning") icon = '<i class="fas fa-exclamation-triangle"></i>';


  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 50);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 1500);
}
