import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE_PATH=/atlas/cells/ builds the EASI-hosted copy; the default keeps the
// site at the root for local development and other hosts.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
});
