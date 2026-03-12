import Address from "../../models/addressSchema.js";
import User from "../../models/userSchema.js";

// Load Address Page
const loadAddressPage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    const addressDoc = await Address.findOne({ user: userId });
    const addresses = addressDoc ? addressDoc.addresses : [];
    res.render("address", { user, addresses });
  } catch (error) {
    next(error);
  }
};

const addAddress = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const {
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
  } catch (error) {
    next(error);
  }
};

const loadEditAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.session.user;
    const user = await User.findById(userId);
    const addressDoc = await Address.findOne({ user: userId });
    const address = addressDoc.addresses.find((addr) => addr._id.toString() === id);
    if (!address) return res.redirect("/address");
    res.render("editAddress", { user,address });
  } catch (error) {
    next(error);
  }
};

const updateAddress = async (req, res, next) => {
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
  } catch (error) {
    next(error);
  }
};

const deleteAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.session.user;

    const addressDoc = await Address.findOne({ user: userId });

    const deletedAddr = addressDoc.addresses.find(
      (addr) => addr._id.toString() === id
    );

    addressDoc.addresses = addressDoc.addresses.filter(
      (addr) => addr._id.toString() !== id
    );

    // If deleted address was default, set another as default
    if (deletedAddr?.isDefault && addressDoc.addresses.length > 0) {
      addressDoc.addresses[0].isDefault = true;
    }

    await addressDoc.save();

    res.json({ success: true, message: "Address deleted" });
  } catch (error) {
    next(error);
  }
};

const setDefaultAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.session.user;
    const addressDoc = await Address.findOne({ user: userId });
    addressDoc.addresses.forEach((addr) => (addr.isDefault = addr._id.toString() === id));
    await addressDoc.save();
    res.json({ success: true, message: "Default address updated" });
  } catch (error) {
    next(error);
  }
};

export default {
  loadAddressPage,
  addAddress,
  loadEditAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
