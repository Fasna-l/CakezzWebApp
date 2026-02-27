document.addEventListener('DOMContentLoaded', function () {

  function validateAddressForm(data) {
    let valid = true;

    document.querySelectorAll('.error-message').forEach(el => {
      el.textContent = '';
      el.style.display = 'none';
    });

    const phoneRegex = /^\d{10}$/;
    const textRegex = /^[A-Za-z\s]+$/i;
    const pincodeRegex = /^\d{6}$/;

    if (!data.phone || !phoneRegex.test(data.phone.trim())) {
      showError('phoneError', 'Enter valid 10-digit number'); valid = false;
    }
    if (!data.streetAddress || data.streetAddress.trim().length < 5) {
      showError('streetAddressError', 'Enter valid street address'); valid = false;
    }
    if (!data.city || !textRegex.test(data.city.trim())) {
      showError('cityError', 'Enter valid city'); valid = false;
    }
    if (!data.state || !textRegex.test(data.state.trim())) {
      showError('stateError', 'Enter valid state'); valid = false;
    }
    if (!data.pincode || !pincodeRegex.test(data.pincode.trim())) {
      showError('pincodeError', 'Enter 6-digit pincode'); valid = false;
    }
    if (!data.district || !textRegex.test(data.district.trim())) {
      showError('districtError', 'Select valid district'); valid = false;
    }
    if (data.landmark && data.landmark.trim().length < 2) {
      showError('landmarkError', 'Invalid landmark'); valid = false;
    }

    return valid;
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.style.display = "block";
  }

  const form = document.getElementById('addAddressForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(e.target).entries());
    if (!validateAddressForm(data)) return;

    const res = await fetch("/checkout/add-address", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.success) {
      Swal.fire({
        title: "Address Added!",
        text: "Your address has been saved successfully.",
        icon: "success",
        confirmButtonText: "Continue"
      }).then(() => {
        window.location.href = "/checkout";
      });

    } else {
        Swal.fire({
        icon: "error",
        title: "Something went wrong",
        text: result.message || "Failed to add address.",
      });
    }

    });

  });
