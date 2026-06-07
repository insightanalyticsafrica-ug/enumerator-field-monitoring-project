// // @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// // or the app will break with duplicate plugins:
// //   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
// //     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
// //     error logger plugins, and sandbox detection (port/host/strictPort).
// // You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
// import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// export default defineConfig({
//   tanstackStart: {
//     // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
//     // nitro/vite builds from this
//     server: { entry: "server" },
//   },
// });

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Native Vite plugin setup for Tailwind v4
  ],
  resolve: {
    alias: {
      // This preserves your '@/' path mapping so your component imports don't break
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Replace 'your-repository-name' with the exact name of your GitHub repository when deploying
  base: process.env.NODE_ENV === 'production' ? '/enumerator_field_monitoring_project/' : '/',
})

