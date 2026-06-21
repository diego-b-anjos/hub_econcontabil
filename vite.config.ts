import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
    hmr: true,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-router-dom",
      "@tanstack/react-query",
      "zustand",
      "sonner",
      "class-variance-authority",
      "clsx",
      "tailwind-merge",
      "next-themes",
      "lucide-react",
      "recharts",
      "html2canvas",
      "file-saver",
      "exceljs",
      "xlsx",
      "jspdf",
      "jspdf-autotable",
      "pptxgenjs",
      "jszip",
    ],
    exclude: ["pdfjs-dist"],
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          charts: ["recharts"],
          xlsx: ["xlsx", "exceljs"],
          pdf: ["jspdf", "jspdf-autotable", "pptxgenjs"],
        },
      },
    },
  },
});
