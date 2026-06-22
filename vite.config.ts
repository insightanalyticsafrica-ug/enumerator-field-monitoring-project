import { defineConfig, loadEnv } from "vite";
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
      tanstackStart(), // 💡 Automatically orchestrates Nitro under the hood!
      react(),
    ],
    define: {
      // Injection for streaming real-time KoBo inputs securely
      "process.env.KOBO_TOKEN": JSON.stringify(env.KOBO_TOKEN || env.VITE_KOBO_TOKEN),
      "process.env.KOBO_ASSET_UID": JSON.stringify(env.KOBO_ASSET_UID || env.VITE_KOBO_ASSET_UID),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  };
});



// import { defineConfig, loadEnv } from "vite";
// import react from "@vitejs/plugin-react";
// // import { tanstackRouter } from "@tanstack/router-plugin/vite";
// import { tanstackStart } from "@tanstack/react-start/plugin/vite";
// import tailwindcss from "@tailwindcss/vite";
// import { nitro } from "nitro/vite";
// import path from "path";

// export default defineConfig(({ mode }) => {
//   // Load environment configurations based on current working directory
//   const env = loadEnv(mode, process.cwd(), "");
  
//   return {
//     plugins: [
//       tailwindcss(),
//       tanstackStart(),
//       nitro(),
//       react(),
//     ],
//     define: {
//       // Direct injection fallback targeting development processes
//       "process.env.KOBO_TOKEN": JSON.stringify(env.KOBO_TOKEN || env.VITE_KOBO_TOKEN),
//       "process.env.KOBO_ASSET_UID": JSON.stringify(env.KOBO_ASSET_UID || env.VITE_KOBO_ASSET_UID),
//     },
//     resolve: {
//       alias: {
//         "@": path.resolve(__dirname, "./src"),
//       },
//     },
//     // CRITICAL: Tells the compiler to look inside your specific repository folder path
//     // base: "/enumerator-field-monitoring-project/",
//     // base: process.env.NODE_ENV === 'production' ? '/enumerator-field-monitoring-project/' : '/',
//     server: {
//       port: 5173,
//       strictPort: true,
//     },
//     // 👈 ADD THIS BUILD OPTIMIZATION BLOCK TO FIX THE 17MB CHUNK CRASH
//     build: {
//       chunkSizeWarningLimit: 2000,
//       rollupOptions: {
//         output: {
//           manualChunks(id) {
//             if (id.includes("node_modules")) {
//               if (id.includes("leaflet") || id.includes("react-leaflet")) {
//                 return "vendor-maps"; // Put heavy mapping packages into their own file
//               }
//               if (id.includes("@tanstack")) {
//                 return "vendor-tanstack"; // Isolate state-routing
//               }
//               return "vendor-core"; // Standard dependencies
//             }
//           },
//         },
//       },
//     },
//   };
// });


// // import { defineConfig } from "vite";
// // import { tanstackRouter } from "@tanstack/router-plugin/vite";
// // import react from "@vitejs/plugin-react";
// // import { tanstackStart } from "@tanstack/react-start/plugin/vite";
// // import tailwindcss from "@tailwindcss/vite";
// // // import tsconfigPaths from "vite-tsconfig-paths";
// // import path from "path";



// // export default defineConfig({
// //   plugins: [
// //     tailwindcss(),
// //     // Temporarily disabled to diagnose code-splitter HMR issue
// //     // tanstackRouter({
// //     //   autoCodeSplitting: false,
// //     //   codeSplittingOptions: {
// //     //     addHmr: false,
// //     //   },
// //     // }),
// //     tanstackStart(),
// //     react(),
    
// //     //   {
// //     //   server: { entry: "server" },
// //     // }
// //     // tsconfigPaths(),
// //   ],
// //   resolve: {
// //   alias: {
// //     "@": path.resolve(__dirname, "./src"),
// //     },
// //   },
// //   // resolve: {
// //   //   alias: [{ find: "@", replacement: new URL("./src", import.meta.url).pathname }],
// //   // },
// //   // server: {
// //   //   host: "0.0.0.0",
// //   //   strictPort: false,
// //   // },
// // });

