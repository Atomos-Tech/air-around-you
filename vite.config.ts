import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    nitro({ vercel: { functions: { runtime: "nodejs22.x" } } }),
    tailwindcss(),
    tanstackStart(),
    react(),
  ],
  resolve: { tsconfigPaths: true },
});
