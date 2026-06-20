import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "rollup-plugin-typescript2";

function minify() {
  return terser({
    compress: { passes: 2, module: true },
    format: { comments: false },
    mangle: true,
  });
}

export default {
  input: "src/library.ts",
  output: [
    {
      file: "dist/index.mjs",
      format: "es",
      sourcemap: true,
      plugins: [minify()],
    },
    {
      file: "dist/index.cjs",
      format: "cjs",
      sourcemap: true,
      exports: "named",
      plugins: [minify()],
    },
    {
      file: "dist/appweaver.umd.min.js",
      format: "umd",
      name: "AppWeaver",
      sourcemap: true,
      plugins: [minify()],
    },
  ],
  plugins: [
    resolve({ extensions: [".ts", ".tsx", ".js", ".jsx", ".json"] }),
    typescript({
      tsconfig: "./tsconfig.build.json",
      clean: true,
    }),
  ],
};
