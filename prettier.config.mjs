/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  trailingComma: "all",
  tabWidth: 2,
  singleQuote: true,
  printWidth: 100,
  semi: true,
  overrides: [
    {
      "files": "packages/insomnia/**/*",
      "options": {
        "plugins": ["prettier-plugin-tailwindcss"]
      }
    }
  ]
};

export default config;
