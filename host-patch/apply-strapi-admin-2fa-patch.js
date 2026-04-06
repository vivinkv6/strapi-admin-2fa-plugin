const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();

const patchFiles = [
  {
    source: path.join(
      rootDir,
      "scripts",
      "strapi-admin-2fa-patch",
      "pages",
      "Auth",
      "components",
      "Login.js"
    ),
    target: path.join(
      rootDir,
      "node_modules",
      "@strapi",
      "admin",
      "dist",
      "admin",
      "admin",
      "src",
      "pages",
      "Auth",
      "components",
      "Login.js"
    ),
  },
  {
    source: path.join(
      rootDir,
      "scripts",
      "strapi-admin-2fa-patch",
      "pages",
      "Auth",
      "components",
      "Login.mjs"
    ),
    target: path.join(
      rootDir,
      "node_modules",
      "@strapi",
      "admin",
      "dist",
      "admin",
      "admin",
      "src",
      "pages",
      "Auth",
      "components",
      "Login.mjs"
    ),
  },
  {
    source: path.join(rootDir, "scripts", "strapi-admin-2fa-patch", "services", "auth.js"),
    target: path.join(
      rootDir,
      "node_modules",
      "@strapi",
      "admin",
      "dist",
      "admin",
      "admin",
      "src",
      "services",
      "auth.js"
    ),
  },
  {
    source: path.join(rootDir, "scripts", "strapi-admin-2fa-patch", "services", "auth.mjs"),
    target: path.join(
      rootDir,
      "node_modules",
      "@strapi",
      "admin",
      "dist",
      "admin",
      "admin",
      "src",
      "services",
      "auth.mjs"
    ),
  },
];

const generatedCacheDirs = [
  path.join(rootDir, "node_modules", ".strapi", "vite"),
  path.join(rootDir, ".strapi", "client"),
];

const missing = patchFiles.find(
  ({ source, target }) => !fs.existsSync(source) || !fs.existsSync(target)
);

if (missing) {
  console.warn("[admin-2fa-patch] Skipping Strapi admin patch because a source or target file is missing.");
  process.exit(0);
}

for (const { source, target } of patchFiles) {
  fs.copyFileSync(source, target);
}

for (const generatedDir of generatedCacheDirs) {
  if (fs.existsSync(generatedDir)) {
    fs.rmSync(generatedDir, { recursive: true, force: true });
  }
}

console.log(
  "[admin-2fa-patch] Applied Strapi admin OTP login patch and cleared Strapi admin caches."
);
