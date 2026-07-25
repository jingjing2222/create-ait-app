import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addProjectSamples, inspectSampleProject } from "../src/scaffold/add-project-samples.js";

const temporaryDirectories: string[] = [];

function createVanillaTypeScriptProject(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "create-ait-add-sample-"));
  temporaryDirectories.push(directory);
  mkdirSync(path.join(directory, "src"));
  writeFileSync(path.join(directory, "src", "main.ts"), "");
  writeFileSync(path.join(directory, "src", "style.css"), "");
  writeFileSync(path.join(directory, "tsconfig.json"), "{}");
  writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify({
      createAitApp: {
        createViteVersion: "9.1.1",
        framework: "vanilla",
        originalScripts: {
          build: "tsc && vite build",
          dev: "vite",
        },
        sampleShellManaged: false,
        samples: [],
        source: "create-vite",
        template: "vanilla-ts",
      },
      devDependencies: {
        vite: "9.1.1",
      },
      scripts: {
        build: "ait build",
        dev: "granite dev",
      },
    }),
  );
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("addProjectSamples", () => {
  it("adds new samples while preserving previously installed samples", () => {
    const directory = createVanillaTypeScriptProject();

    expect(addProjectSamples(directory, ["iap"])).toMatchObject({
      addedSampleIds: ["iap"],
      installedSampleIds: ["iap"],
      skippedSampleIds: [],
    });
    expect(existsSync(path.join(directory, "src", "pages", "InAppPurchasePage.ts"))).toBe(true);

    const mainPath = path.join(directory, "src", "main.ts");
    writeFileSync(
      mainPath,
      readFileSync(mainPath, "utf8").replace(
        "<h1>Apps in Toss</h1>",
        "<h1>사용자가 수정한 앱</h1>",
      ),
    );

    expect(addProjectSamples(directory, ["iap", "iaa"])).toMatchObject({
      addedSampleIds: ["iaa"],
      installedSampleIds: ["iap", "iaa"],
      skippedSampleIds: ["iap"],
    });

    const main = readFileSync(mainPath, "utf8");
    expect(main).toContain("mountInAppPurchasePage");
    expect(main).toContain("mountInAppAdsPage");
    expect(main).toContain("<h1>사용자가 수정한 앱</h1>");
    expect(inspectSampleProject(directory).installedSampleIds).toEqual(["iap", "iaa"]);
  });

  it("rejects projects without create-ait-app metadata", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "create-ait-unsupported-"));
    temporaryDirectories.push(directory);
    writeFileSync(path.join(directory, "package.json"), "{}");

    expect(() => addProjectSamples(directory, ["iap"])).toThrow("create-ait-app으로 만든 프로젝트");
  });

  it("refuses to overwrite a sample shell when its management markers are missing", () => {
    const directory = createVanillaTypeScriptProject();
    addProjectSamples(directory, ["iap"]);

    const mainPath = path.join(directory, "src", "main.ts");
    const customizedMain = readFileSync(mainPath, "utf8").replace(
      "// create-ait-app:sample-routes:start",
      "// 사용자가 관리 구간을 제거함",
    );
    writeFileSync(mainPath, customizedMain);

    expect(() => addProjectSamples(directory, ["iaa"])).toThrow(
      "App/main 파일을 안전하게 수정할 수 없어요",
    );
    expect(readFileSync(mainPath, "utf8")).toBe(customizedMain);
    expect(inspectSampleProject(directory).installedSampleIds).toEqual(["iap"]);
  });
});
