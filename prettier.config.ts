import { type Config } from "prettier";

const config: Config = {
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
