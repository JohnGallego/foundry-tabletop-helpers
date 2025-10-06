import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      output: {
        // ensure asset names are stable (no hashes)
        assetFileNames: (chunkInfo) => {
          // keep css as 'style.css'
          if (chunkInfo.name === "style.css") return "style.css";
          // keep everything else in place, no hashing
          return "[name][extname]";
        },
      },
    },
  },
  publicDir: "public", // copies verbatim to dist/
});
