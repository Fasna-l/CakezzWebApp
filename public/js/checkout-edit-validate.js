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
      show('phoneError', 'Enter valid 10-digit number');
      valid = false;
    }
    if (!data.streetAddress || data.streetAddress.trim().length < 5) {
      show('streetAddressError', 'Enter valid street address');
      valid = false;
    }
    if (!data.city || !textRegex.test(data.city.trim())) {
      show('cityError', 'Enter valid city');
      valid = false;
    }
    if (!data.district || !textRegex.test(data.district.trim())) {
      show('districtError', 'Select valid district');
      valid = false;
    }
    if (!data.state || !textRegex.test(data.state.trim())) {
      show('stateError', 'Enter valid state');
      valid = false;
    }
    if (!data.pincode || !pincodeRegex.test(data.pincode.trim())) {
      show('pincodeError', 'Enter 6-digit pincode');
      valid = false;
    }
    if (data.landmark && data.landmark.trim().length < 2) {
      show('landmarkError', 'Invalid landmark');
      valid = false;
    }

    return valid;
  }

  function show(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.style.display = 'block';
  }

  const form = document.getElementById('editAddressForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());

    if (!validateAddressForm(data)) return;

    const res = await fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.success) {
      window.location.href = "/checkout";
    } else {
      alert(result.message || "Failed to update address");
    }
  });

});
