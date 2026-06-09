import { defineConfig, loadEnv } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load environment configurations based on current working directory
  const env = loadEnv(mode, process.cwd(), "");
  
  return {
    plugins: [
      tailwindcss(),
      tanstackStart(),
      react(),
    ],
    define: {
      // Direct injection fallback targeting development processes
      "process.env.KOBO_TOKEN": JSON.stringify(env.KOBO_TOKEN || env.VITE_KOBO_TOKEN),
      "process.env.KOBO_ASSET_UID": JSON.stringify(env.KOBO_ASSET_UID || env.VITE_KOBO_ASSET_UID),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});


// import { defineConfig } from "vite";
// import { tanstackRouter } from "@tanstack/router-plugin/vite";
// import react from "@vitejs/plugin-react";
// import { tanstackStart } from "@tanstack/react-start/plugin/vite";
// import tailwindcss from "@tailwindcss/vite";
// // import tsconfigPaths from "vite-tsconfig-paths";
// import path from "path";



// export default defineConfig({
//   plugins: [
//     tailwindcss(),
//     // Temporarily disabled to diagnose code-splitter HMR issue
//     // tanstackRouter({
//     //   autoCodeSplitting: false,
//     //   codeSplittingOptions: {
//     //     addHmr: false,
//     //   },
//     // }),
//     tanstackStart(),
//     react(),
    
//     //   {
//     //   server: { entry: "server" },
//     // }
//     // tsconfigPaths(),
//   ],
//   resolve: {
//   alias: {
//     "@": path.resolve(__dirname, "./src"),
//     },
//   },
//   // resolve: {
//   //   alias: [{ find: "@", replacement: new URL("./src", import.meta.url).pathname }],
//   // },
//   // server: {
//   //   host: "0.0.0.0",
//   //   strictPort: false,
//   // },
// });

