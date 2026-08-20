import path from "node:path";
import { fileURLToPath } from "node:url";
import { cpSync, copyFileSync, mkdirSync } from "node:fs";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const mobileRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(mobileRoot, "..");
const mobileLoginActions = path.resolve(mobileRoot, "src/login-actions.js");
const mobileOutput = path.resolve(projectRoot, "mobile-dist");

const mobileModuleResolver = {
  name: "string-art-mobile-modules",
  enforce: "pre",
  resolveId(source) {
    if (/app\/login\/actions\.js$/.test(source)) return mobileLoginActions;
    return null;
  },
};

const mobilePublicAssets = {
  name: "string-art-mobile-public-assets",
  closeBundle() {
    mkdirSync(path.join(mobileOutput, "audio"), { recursive: true });
    cpSync(
      path.resolve(projectRoot, "public/audio/build"),
      path.join(mobileOutput, "audio/build"),
      { recursive: true },
    );
    copyFileSync(
      path.resolve(projectRoot, "public/logo-white-compact.png"),
      path.join(mobileOutput, "logo-white-compact.png"),
    );
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");

  return {
    root: mobileRoot,
    base: "/",
    publicDir: false,
    plugins: [mobileModuleResolver, react(), mobilePublicAssets],
    resolve: {
      alias: [
        {
          find: "next/navigation",
          replacement: path.resolve(mobileRoot, "src/next-navigation.js"),
        },
      ],
    },
    define: {
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_URL || "",
      ),
      "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
      ),
    },
    build: {
      outDir: mobileOutput,
      emptyOutDir: true,
      sourcemap: false,
      target: "es2022",
    },
  };
});
