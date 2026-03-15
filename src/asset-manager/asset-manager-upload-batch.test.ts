import { describe, expect, it, vi } from "vitest";

import { processBatchOptimizationEntry } from "./asset-manager-upload-batch";
import type { OptPresetConfig } from "./asset-manager-upload";

const config: OptPresetConfig = {
  label: "Map",
  maxWidth: 4096,
  maxHeight: 4096,
  quality: 0.9,
  toWebP: true,
};

function makeFile(name: string, size: number, type = ""): File {
  const file = new File(["x"], name, { type, lastModified: 0 });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("asset manager upload batch helper", () => {
  it("uses the server optimizer for images and deletes the original on rename", async () => {
    const uploadFn = vi.fn(async () => "ok");
    const deleteOriginal = vi.fn(async () => undefined);

    const outcome = await processBatchOptimizationEntry(
      "art/portrait.png",
      "art",
      "portrait.png",
      makeFile("portrait.png", 300_000, "image/png"),
      "image",
      {
        serverCaps: { image: true, audio: false, video: false, thumbnail: false, portrait: false },
        resolvedPreset: "portrait",
        config,
        uploadFn,
        optimizeAudio: vi.fn(),
        optimizeImageWithWorker: null,
        serverOptimizeImage: vi.fn(async () => ({
          blob: new Blob(["optimized"], { type: "image/webp" }),
          originalSize: 300_000,
          optimizedSize: 100_000,
          skipped: false,
        })),
        serverOptimizeAudio: vi.fn(),
        serverOptimizeVideo: vi.fn(),
        deleteOriginal,
      },
    );

    expect(outcome).toEqual({ processed: true, savedBytes: 200_000 });
    expect(uploadFn).toHaveBeenCalled();
    expect(deleteOriginal).toHaveBeenCalledWith("art/portrait.png");
  });

  it("falls back to client audio optimization when the server is unavailable", async () => {
    const uploadFn = vi.fn(async (_file: File, name: string) => name);
    const deleteOriginal = vi.fn(async () => undefined);
    const optimized = new Blob(["optimized-audio"], { type: "audio/ogg" });
    Object.defineProperty(optimized, "size", { value: 120_000 });

    const outcome = await processBatchOptimizationEntry(
      "music/theme.wav",
      "music",
      "theme.wav",
      makeFile("theme.wav", 500_000, "audio/wav"),
      "audio",
      {
        serverCaps: null,
        resolvedPreset: "auto",
        config: null,
        uploadFn,
        optimizeAudio: vi.fn(async () => ({ blob: optimized, mime: "audio/ogg;codecs=opus" })),
        optimizeImageWithWorker: null,
        serverOptimizeImage: vi.fn(),
        serverOptimizeAudio: vi.fn(),
        serverOptimizeVideo: vi.fn(),
        deleteOriginal,
      },
    );

    expect(outcome).toEqual({ processed: true, savedBytes: 380_000 });
    const firstCall = uploadFn.mock.calls.at(0);
    expect(firstCall?.[1]).toBe("theme.ogg");
    expect(deleteOriginal).toHaveBeenCalledWith("music/theme.wav");
  });

  it("skips video when no server optimization is available", async () => {
    const outcome = await processBatchOptimizationEntry(
      "video/intro.mp4",
      "video",
      "intro.mp4",
      makeFile("intro.mp4", 1_500_000, "video/mp4"),
      "video",
      {
        serverCaps: null,
        resolvedPreset: "map",
        config,
        uploadFn: vi.fn(),
        optimizeAudio: vi.fn(),
        optimizeImageWithWorker: null,
        serverOptimizeImage: vi.fn(),
        serverOptimizeAudio: vi.fn(),
        serverOptimizeVideo: vi.fn(),
        deleteOriginal: vi.fn(),
      },
    );

    expect(outcome).toEqual({ processed: false, savedBytes: 0 });
  });
});
