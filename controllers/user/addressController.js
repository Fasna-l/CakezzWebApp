const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");

// ✅ Load Address Page
const loadAddressPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    const addressDoc = await Address.findOne({ user: userId });
    const addresses = addressDoc ? addressDoc.addresses : [];
    res.render("address", { user, addresses });
  } catch (err) {
    console.error("Error loading address page:", err);
    res.redirect("/pageNotFound");
  }
};

// ✅ Add Address
const addAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const {
      //fullName,
      phone,
      streetAddress,
      city,
      state,
      district,
      pincode,
      landmark,
      addressType,
    } = req.body;

    if ( !phone || !streetAddress || !city || !state || !pincode || !district )
      return res.json({ success: false, message: "Missing required fields" });

    let addressDoc = await Address.findOne({ user: userId });
    const newAddress = { phone, streetAddress, city, state, district, pincode, landmark, addressType };

    if (!addressDoc) {
      addressDoc = new Address({ user: userId, addresses: [newAddress] });
    } else {
      addressDoc.addresses.push(newAddress);
    }

    await addressDoc.save();
    res.json({ success: true, message: "Address added", address: newAddress });
  } catch (err) {
    console.error("Error adding address:", err);
    res.json({ success: false, message: "Internal server error" });
  }
};

// ✅ Load Edit Page
const loadEditAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user;
    const user = await User.findById(userId);
    const addressDoc = await Address.findOne({ user: userId });
    const address = addressDoc.addresses.find((addr) => addr._id.toString() === id);
    if (!address) return res.redirect("/address");
    res.render("editAddress", { user,address });
  } catch (err) {
    console.error("Error loading edit page:", err);
    res.redirect("/address");
  }
};

// ✅ Update Address
const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const addressDoc = await Address.findOne({ "addresses._id": id });

    if (!addressDoc)
      return res.json({ success: false, message: "Address not found" });

    await Address.updateOne(
      { "addresses._id": id },
      {
        $set: {
          //"addresses.$.fullName": data.fullName,
          "addresses.$.phone": data.phone,
          "addresses.$.streetAddress": data.streetAddress,
          "addresses.$.city": data.city,
          "addresses.$.state": data.state,
          "addresses.$.district": data.district,
          "addresses.$.pincode": data.pincode,
          "addresses.$.landmark": data.landmark,
          "addresses.$.addressType": data.addressType,
        },
      }
    );

    res.json({ success: true, message: "Address updated successfully" });
  } catch (err) {
    console.error("Error updating address:", err);
    res.json({ success: false, message: "Internal error" });
  }
};

// ✅ Delete Address
const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    await Address.updateOne(
      { "addresses._id": id },
      { $pull: { addresses: { _id: id } } }
    );
    res.json({ success: true, message: "Address deleted" });
  } catch (err) {
    console.error("Error deleting address:", err);
    res.json({ success: false, message: "Internal error" });
  }
};

// ✅ Set Default Address
const setDefaultAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user;
    const addressDoc = await Address.findOne({ user: userId });
    addressDoc.addresses.forEach((addr) => (addr.isDefault = addr._id.toString() === id));
    await addressDoc.save();
    res.json({ success: true, message: "Default address updated" });
  } catch (err) {
    console.error("Error setting default:", err);
    res.json({ success: false, message: "Internal error" });
  }
};

module.exports = {
  loadAddressPage,
  addAddress,
  loadEditAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
