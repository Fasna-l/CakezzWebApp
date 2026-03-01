import js from "@eslint/js";
import globals from "globals";

export default [

  // ✅ Backend (Node)
  {
    files: ["controllers/**/*.js", "models/**/*.js", "routes/**/*.js", "middlewares/**/*.js", "helpers/**/*.js", "app.js"],
    ...js.configs.recommended,

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node
      }
    },

    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "no-undef": "error"
    }
  },

  // ✅ Frontend (Browser)
  {
    files: ["public/**/*.js"],
    ...js.configs.recommended,

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser
      }
    },

    rules: {
      "no-unused-vars": "warn",
      "no-console": "off"
    }
  }

];