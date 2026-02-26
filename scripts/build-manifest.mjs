import fs from "node:fs";
import path from "node:path";
const root = new URL("..", import.meta.url).pathname;

const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);
const tpl = JSON.parse(
  fs.readFileSync(path.join(root, "module.template.json"), "utf8")
);

/** Stamp version from package.json */
tpl.version = pkg.version;

/** keep URLs in sync with repo slug */
const owner = "JohnGallego";
const repo = "foundry-tabletop-helpers";
tpl.manifest = `https://raw.githubusercontent.com/${owner}/${repo}/main/module.json`;
tpl.download = `https://github.com/${owner}/${repo}/releases/latest/download/${repo}.zip`;

/** Write to dist/ */
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(
  path.join(root, "dist", "module.json"),
  JSON.stringify(tpl, null, 2),
  "utf8"
);

/** Also copy README.md for convenience */
fs.copyFileSync(
  path.join(root, "README.md"),
  path.join(root, "dist", "README.md")
);

/** Copy templates recursively (if present) */
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const tplDir = path.join(root, "templates");
if (fs.existsSync(tplDir)) {
  copyDirRecursive(tplDir, path.join(root, "dist", "templates"));
}
console.log("Manifest built → dist/module.json");
