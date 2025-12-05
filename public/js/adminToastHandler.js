document.addEventListener("DOMContentLoaded", () => {
    const toastBox = document.getElementById("toast-data");

    if (!toastBox) return;

    const message = toastBox.dataset.message;
    const type = toastBox.dataset.type;

    if (message && type) {
        showToast(message, type);
    }
});
