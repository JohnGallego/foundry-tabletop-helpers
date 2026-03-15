import { describe, expect, it } from "vitest";

import {
  audioMimeToExt,
  autoDetectPreset,
  createUploadQueueItems,
  createUploadQueueItemsWithOptions,
  detectAudioBitrate,
  resolveUploadOutputName,
  sanitizeFilename,
  splitOptimizableBatchFiles,
} from "./asset-manager-upload-helpers";
import type { OptPresetConfig, UploadDialogResult } from "./asset-manager-upload";

const presets: Record<"icon" | "token" | "portrait" | "map", OptPresetConfig> = {
  icon: { label: "Icon", maxWidth: 128, maxHeight: 128, quality: 0.85, toWebP: true },
  token: { label: "Token", maxWidth: 400, maxHeight: 400, quality: 0.85, toWebP: true },
  portrait: { label: "Portrait", maxWidth: 800, maxHeight: 800, quality: 0.85, toWebP: true },
  map: { label: "Map", maxWidth: 16384, maxHeight: 16384, quality: 0.9, toWebP: true },
};

function makeFile(name: string, size: number, type = ""): File {
  const file = new File(["x"], name, { type, lastModified: 0 });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("asset manager upload helpers", () => {
  it("sanitizes filenames and derives output extensions", () => {
    expect(sanitizeFilename("My Token 01!.PNG")).toBe("my-token-01.png");
    expect(audioMimeToExt("audio/ogg;codecs=opus")).toBe("ogg");
    expect(audioMimeToExt("audio/webm")).toBe("webm");
    expect(resolveUploadOutputName(makeFile("Portrait Final.JPG", 200_000), "portrait", null, presets)).toBe("portrait-final.webp");
    expect(resolveUploadOutputName(makeFile("Battle Theme.wav", 4_000_000), "auto", "audio/ogg;codecs=opus", presets)).toBe("battle-theme.ogg");
    expect(resolveUploadOutputName(makeFile("Cutscene.mov", 8_000_000), "map", null, presets)).toBe("cutscene.webm");
  });

  it("detects presets and audio bitrates from file heuristics", () => {
    expect(autoDetectPreset(makeFile("Goblin Token.png", 180_000), "image")).toBe("token");
    expect(autoDetectPreset(makeFile("WorldMap.jpg", 4_000_000), "image")).toBe("map");
    expect(autoDetectPreset(makeFile("Forest Ambience.wav", 5_000_000), "audio")).toBe("auto");
    expect(autoDetectPreset(makeFile("notes.txt", 10_000), "text")).toBe("none");
    expect(detectAudioBitrate("forest-ambient-loop.wav")).toBe(96_000);
    expect(detectAudioBitrate("boss-battle-theme.flac")).toBe(160_000);
    expect(detectAudioBitrate("slash-hit-sfx.wav")).toBe(128_000);
  });

  it("creates queue items and splits batch files by optimizable type", () => {
    const queueItems = createUploadQueueItems([
      makeFile("Hero Token.png", 120_000),
      makeFile("Town Theme.wav", 5_000_000),
    ], "auto", 10, "audio/ogg;codecs=opus", presets);

    expect(queueItems.map((item) => ({
      id: item.id,
      outputName: item.outputName,
      preset: item.preset,
      status: item.status,
    }))).toEqual([
      { id: 10, outputName: "hero-token.webp", preset: "token", status: "pending" },
      { id: 11, outputName: "town-theme.ogg", preset: "auto", status: "pending" },
    ]);

    const dialogItems: UploadDialogResult[] = [
      {
        file: makeFile("Portrait.png", 300_000),
        outputName: "portrait.webp",
        preset: "portrait",
      },
    ];
    expect(createUploadQueueItemsWithOptions(dialogItems, 50)[0]).toMatchObject({
      id: 50,
      outputName: "portrait.webp",
      preset: "portrait",
      status: "pending",
    });

    expect(splitOptimizableBatchFiles([
      "art/token.png",
      "music/theme.wav",
      "video/intro.mp4",
      "art/icon.webp",
      "docs/readme.txt",
    ])).toEqual({
      images: ["art/token.png"],
      audio: ["music/theme.wav"],
      video: ["video/intro.mp4"],
      all: ["art/token.png", "music/theme.wav", "video/intro.mp4"],
    });
  });
});
