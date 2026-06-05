/// <reference types="node" />

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  getSpecialtyIconKey,
  normalizeSpecialtyName,
} from "./specialty-icon-registry.ts";

const directSpecialtyLucideImports = new Set([
  "Activity",
  "Baby",
  "Bean",
  "Bone",
  "Brain",
  "CircleDot",
  "Ear",
  "Eye",
  "Female",
  "Hand",
  "Heart",
  "Kidney",
  "Lungs",
  "Microscope",
  "Pill",
  "Scan",
  "Scissors",
  "Shield",
  "Skin",
  "Stethoscope",
  "Venus",
  "Wind",
]);

const specialtyEmojiPatterns = [
  "❤️",
  "🦴",
  "🔪",
  "🫁",
  "🧠",
  "🫀",
  "⚗️",
  "🩸",
  "🔬",
  "🦠",
  "🩺",
  "ðŸ",
  "â",
  "âš",
];

describe("game specialty icon registry", () => {
  it("uses stethoscope for null, empty, and unknown specialties", () => {
    assert.equal(getSpecialtyIconKey(null), "stethoscope");
    assert.equal(getSpecialtyIconKey(undefined), "stethoscope");
    assert.equal(getSpecialtyIconKey(""), "stethoscope");
    assert.equal(getSpecialtyIconKey("   "), "stethoscope");
    assert.equal(getSpecialtyIconKey("Clinical Informatics"), "stethoscope");
  });

  it("resolves spelling variants to the same icon keys", () => {
    assert.equal(getSpecialtyIconKey("Pediatrics"), "baby");
    assert.equal(getSpecialtyIconKey("Paediatrics"), "baby");
    assert.equal(getSpecialtyIconKey("Orthopedics"), "bone");
    assert.equal(getSpecialtyIconKey("Orthopaedics"), "bone");
    assert.equal(getSpecialtyIconKey("Hematology"), "microscope");
    assert.equal(getSpecialtyIconKey("Haematology"), "microscope");
  });

  it("resolves combined specialty labels", () => {
    assert.equal(getSpecialtyIconKey("Obstetrics & Gynecology"), "female");
    assert.equal(getSpecialtyIconKey("General Surgery"), "scissors");
    assert.equal(getSpecialtyIconKey("Internal Medicine"), "stethoscope");
  });

  it("normalizes casing, extra spaces, hyphens, and and/ampersand variants", () => {
    assert.equal(normalizeSpecialtyName("  PEDIATRICS  "), "pediatrics");
    assert.equal(normalizeSpecialtyName("Emergency-Medicine"), "emergency medicine");
    assert.equal(
      normalizeSpecialtyName("Obstetrics & Gynecology"),
      "obstetrics and gynecology",
    );
    assert.equal(
      getSpecialtyIconKey("  obstetrics   and   gynecology  "),
      "female",
    );
    assert.equal(getSpecialtyIconKey("emergency-medicine"), "activity");
  });
});

describe("game specialty icon rendering ownership", () => {
  it("keeps old specialty emoji maps and specialty emoji render paths out of Learn", async () => {
    const sourceRoot = fileURLToPath(new URL("../../../../", import.meta.url));
    const learnRoot = join(sourceRoot, "features", "game", "react", "learn");
    const files = await collectSourceFiles(learnRoot);
    const violations: string[] = [];

    for (const file of files) {
      const contents = await readFile(file, "utf8");
      if (contents.includes("MOBILE_SPECIALTY_ICONS")) {
        violations.push(`${relative(sourceRoot, file)} contains MOBILE_SPECIALTY_ICONS`);
      }
      if (/getMobileSpecialtyIcon|specialty\.emoji|specialty\.icon|icon\.icon/.test(contents)) {
        violations.push(`${relative(sourceRoot, file)} renders specialty emoji/icon fields`);
      }
      for (const pattern of specialtyEmojiPatterns) {
        if (contents.includes(pattern)) {
          violations.push(`${relative(sourceRoot, file)} contains ${pattern}`);
        }
      }
    }

    assert.deepEqual(violations, []);
  });

  it("keeps feature files from importing specialty Lucide icons directly", async () => {
    const sourceRoot = fileURLToPath(new URL("../../../../", import.meta.url));
    const reactRoot = join(sourceRoot, "features", "game", "react");
    const files = await collectSourceFiles(reactRoot);
    const violations: string[] = [];

    for (const file of files) {
      if (file.includes(`${join("react", "specialties")}${separatorFor(file)}`)) {
        continue;
      }

      const contents = await readFile(file, "utf8");
      const lucideImports = contents.matchAll(
        /import\s*\{([\s\S]*?)\}\s*from\s*["']lucide-react["']/g,
      );

      for (const lucideImport of lucideImports) {
        const importedNames = lucideImport[1]
          .split(",")
          .map((name) => name.trim().split(/\s+as\s+/i)[0])
          .filter(Boolean);
        const directImports = importedNames.filter((name) =>
          directSpecialtyLucideImports.has(name),
        );

        if (directImports.length) {
          violations.push(
            `${relative(sourceRoot, file)} imports ${directImports.join(", ")}`,
          );
        }
      }
    }

    assert.deepEqual(violations, []);
  });
});

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectSourceFiles(path);
      }
      if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
        return [path];
      }
      return [];
    }),
  );
  return files.flat();
}

function separatorFor(path: string) {
  return path.includes("\\") ? "\\" : "/";
}
