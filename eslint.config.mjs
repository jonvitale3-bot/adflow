import nextConfig from "eslint-config-next";

/**
 * Flat config. `next lint` and the .eslintrc format it used are gone in Next
 * 16, and until this file existed the lint script failed before checking a
 * single line: ESLint 9+ was resolved with no config and no plugin installed.
 */
const config = [
  ...nextConfig,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    rules: {
      // Seven sites set state inside an effect: reading localStorage after
      // mount, syncing a form from props when the client changes. Each costs
      // one extra render and none is a defect. Worth fixing as a pass of its
      // own, not worth failing the build on today.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
