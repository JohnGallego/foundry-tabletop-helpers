import { describe, expect, it, vi } from "vitest";

import { processUploadQueueItemOptimization } from "./asset-manager-upload-processing";
import type { OptPresetConfig, UploadQueueItem } from "./asset-manager-upload";

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

function makeItem(overrides: Partial<UploadQueueItem> = {}): UploadQueueItem {
  const file = makeFile("Hero Token.png", 250_000, "image/png");
  return {
    id: 1,
    file,
    originalName: file.name,
    outputName: "hero-token.webp",
    preset: "token",
    status: "pending",
    progress: 0,
    originalSize: file.size,
    optimizedSize: 0,
    ...overrides,
  };
}

describe("asset manager upload processing", () => {
  it("uses the server optimizer for images when available", async () => {
    const item = makeItem();
    const notify = vi.fn();

    const uploaded = await processUploadQueueItemOptimization(item, {
      presets,
      notify,
      workerAvailable: true,
      optimizeImage: vi.fn(),
      optimizeAudio: vi.fn(),
      checkOptimizerServer: vi.fn(async () => ({ image: true, audio: false, video: false, thumbnail: false, portrait: false })),
      serverOptimizeImage: vi.fn(async () => ({
        blob: new Blob(["optimized"], { type: "image/webp" }),
        originalSize: 250_000,
        optimizedSize: 100_000,
        skipped: false,
      })),
      serverOptimizeAudio: vi.fn(),
      serverOptimizeVideo: vi.fn(),
    });

    expect(item.outputName).toBe("hero-token.webp");
    expect(item.optimizedSize).toBe(100_000);
    expect(item.progress).toBe(50);
    expect(uploaded.name).toBe("hero-token.webp");
    expect(uploaded.type).toBe("image/webp");
    expect(notify).toHaveBeenCalled();
  });

  it("falls back to client image optimization when the server is unavailable", async () => {
    const item = makeItem();
    const optimizedBlob = new Blob(["optimized-image"], { type: "image/webp" });
    Object.defineProperty(optimizedBlob, "size", { value: 80_000 });

    const uploaded = await processUploadQueueItemOptimization(item, {
      presets,
      notify: vi.fn(),
      workerAvailable: true,
      optimizeImage: vi.fn(async () => optimizedBlob),
      optimizeAudio: vi.fn(),
      checkOptimizerServer: vi.fn(async () => null),
      serverOptimizeImage: vi.fn(),
      serverOptimizeAudio: vi.fn(),
      serverOptimizeVideo: vi.fn(),
    });

    expect(item.optimizedSize).toBe(80_000);
    expect(item.progress).toBe(50);
    expect(uploaded.name).toBe("hero-token.webp");
    expect(uploaded.type).toBe("image/webp");
  });

  it("keeps the original audio file when client optimization does not reduce size", async () => {
    const file = makeFile("Town Theme.wav", 500_000, "audio/wav");
    const item = makeItem({
      file,
      originalName: file.name,
      outputName: "town-theme.ogg",
      preset: "auto",
      originalSize: file.size,
    });

    const uploaded = await processUploadQueueItemOptimization(item, {
      presets,
      notify: vi.fn(),
      workerAvailable: false,
      optimizeImage: vi.fn(),
      optimizeAudio: vi.fn(async () => {
        const blob = new Blob(["bigger-audio"], { type: "audio/ogg" });
        Object.defineProperty(blob, "size", { value: 600_000 });
        return { blob, mime: "audio/ogg;codecs=opus" };
      }),
      checkOptimizerServer: vi.fn(async () => null),
      serverOptimizeImage: vi.fn(),
      serverOptimizeAudio: vi.fn(),
      serverOptimizeVideo: vi.fn(),
    });

    expect(item.outputName).toBe("Town Theme.wav");
    expect(item.optimizedSize).toBe(0);
    expect(uploaded).toBe(file);
  });
});
