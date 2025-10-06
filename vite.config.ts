import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false, // ensures a single style.css
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js", // stable entry filename
    },
    rollupOptions: {
      output: {
        // keep every file name stable and unhashed
        entryFileNames: "index.js",
        chunkFileNames: "[name].js",
        assetFileNames: (info) => {
          const nameFromArray = Array.isArray(info.names)
            ? info.names[0]
            : undefined;
          const name = nameFromArray ?? info.name ?? "";

          // When cssCodeSplit=false, Vite emits a single CSS asset; ensure it's 'styles.css'
          if (name.endsWith(".css")) return "styles.css";

          // default for all other assets (images, fonts, etc.)
          return "[name][extname]";
        },
      },
    },
  },
  publicDir: "public", // copies verbatim into dist/
});
