/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  trailingComma: "all",
  printWidth: 120,
  arrowParens: "avoid",
  singleQuote: true,
  quoteProps: "consistent",
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
