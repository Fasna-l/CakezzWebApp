const bcrypt = require("bcrypt");

//  Securely hash passwords
async function securePassword(password) {
  try {
    return await bcrypt.hash(password, 10);
  } catch (error) {
    console.error("Password Hashing Error:", error);
    throw error;
  }
}

module.exports = { securePassword };