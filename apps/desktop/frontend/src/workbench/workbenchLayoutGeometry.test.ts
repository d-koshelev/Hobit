import { describe, expect, it } from "vitest";

import { nextDockedResizeGeometry } from "./workbenchLayoutGeometry";

const surfaceRect = {
  height: 900,
  left: 0,
  top: 0,
  width: 1200,
};

describe("workbench layout resize geometry", () => {
  it("resizes from the left edge while preserving the right edge", () => {
    const geometry = nextDockedResizeGeometry({
      direction: "left",
      originalSize: { height: 240, width: 360 },
      pointerX: 48,
      pointerY: 120,
      position: { x: 96, y: 0 },
      resizePointerX: 96,
      resizePointerY: 120,
      surfaceRect,
    });

    expect(geometry).toEqual({
      position: { x: 48, y: 0 },
      size: { height: 240, width: 408 },
    });
  });

  it("resizes from the top edge while preserving the bottom edge", () => {
    const geometry = nextDockedResizeGeometry({
      direction: "top",
      originalSize: { height: 240, width: 360 },
      pointerX: 180,
      pointerY: 48,
      position: { x: 0, y: 96 },
      resizePointerX: 180,
      resizePointerY: 96,
      surfaceRect,
    });

    expect(geometry).toEqual({
      position: { x: 0, y: 48 },
      size: { height: 288, width: 360 },
    });
  });

  it("resizes from existing corners and clamps to minimum widget size", () => {
    const geometry = nextDockedResizeGeometry({
      direction: "bottom-right",
      minimumSize: { minHeight: 480, minWidth: 672 },
      originalSize: { height: 672, width: 840 },
      pointerX: 120,
      pointerY: 160,
      position: { x: 0, y: 0 },
      resizePointerX: 840,
      resizePointerY: 672,
      surfaceRect,
    });

    expect(geometry).toEqual({
      position: { x: 0, y: 0 },
      size: { height: 480, width: 672 },
    });
  });
});
