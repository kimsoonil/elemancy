// 상위 Elemancy 레포의 게임 자산(index.html, src/, data/)을
// public/game/ 으로 복사한다. 게임을 수정한 뒤 `npm run sync` 로 반영.
import { cp, rm, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", ".."); // Elemancy/
const dest = resolve(here, "..", "public", "game");

const items = ["index.html", "src", "data"];

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
for (const item of items) {
  await cp(resolve(repoRoot, item), resolve(dest, item), { recursive: true });
  console.log(`synced ${item}`);
}
console.log(`→ ${dest}`);
