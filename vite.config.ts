import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tooltip', '@radix-ui/react-popover', '@radix-ui/react-tabs', '@radix-ui/react-avatar', '@radix-ui/react-scroll-area', '@radix-ui/react-context-menu', '@radix-ui/react-select'],
          'vendor-motion': ['framer-motion'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-utils': ['date-fns', 'zustand', 'zod', 'clsx', 'tailwind-merge', 'class-variance-authority', 'sonner'],
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 8080,
    strictPort: true,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "libsignal-protocol": path.resolve(__dirname, "node_modules/libsignal-protocol/dist/libsignal-protocol.js"),
    },
  },
}));
