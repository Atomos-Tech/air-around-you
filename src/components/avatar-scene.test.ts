import { Mesh, type BufferGeometry, type Material, type Scene } from "three";
import { afterEach, expect, it, vi } from "vitest";
import { mountAvatar } from "./avatar-scene";

const { render } = vi.hoisted(() => ({ render: vi.fn<(scene: Scene) => void>() }));

vi.mock("three", async (original) => ({
  ...(await original<typeof import("three")>()),
  WebGLRenderer: class {
    domElement = document.createElement("canvas");
    render = render;
    setPixelRatio() {}
    setSize() {}
    setClearColor() {}
    dispose() {}
    forceContextLoss() {}
  },
}));

afterEach(() => vi.unstubAllGlobals());

it("releases every shared avatar geometry and material once when leaving the scene", () => {
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const container = document.createElement("div");
  const avatar = mountAvatar(container);
  const scene = render.mock.lastCall?.[0];
  if (!scene) throw new Error("Avatar scene was never rendered");
  const resources = new Set<BufferGeometry | Material>();
  scene.traverse((part) => {
    if (part instanceof Mesh) {
      resources.add(part.geometry);
      resources.add(part.material);
    }
  });
  expect(resources.size).toBeGreaterThan(0);
  const disposals = [...resources].map((resource) => vi.spyOn(resource, "dispose"));
  avatar.destroy();
  for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
  expect(container.childElementCount).toBe(0);
});
