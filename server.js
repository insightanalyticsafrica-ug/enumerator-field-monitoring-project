import handler from "./dist/server/server.js";

export default handler;

// import { defineEventHandler } from 'h3';

// export default defineEventHandler((event) => {
//   const url = event.node.req.url;

//   // If the user is requesting the core dashboard page or assets, do NOT intercept it.
//   // This allows TanStack Router and Vite to load the real UI.
//   if (url === '/' || url.startsWith('/assets') || url.includes('html')) {
//     return; 
//   }
  
//   // Keep this fallback just for API/server handshakes if needed
//   return { status: "ready" };
// });