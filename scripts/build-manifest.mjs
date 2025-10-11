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

/** Copy templates (if present) */
const tplDir = path.join(root, "templates");
if (fs.existsSync(tplDir)) {
  const outDir = path.join(root, "dist", "templates");
  fs.mkdirSync(outDir, { recursive: true });
  for (const entry of fs.readdirSync(tplDir)) {
    fs.copyFileSync(path.join(tplDir, entry), path.join(outDir, entry));
  }
}
console.log("Manifest built → dist/module.json");
