import type { AnimationClipDefinition } from "./contracts";

export function getAnimationFrame(
  clip: AnimationClipDefinition,
  elapsedMs: number,
) {
  const frameCount = Math.max(1, clip.frameCount);
  const elapsedSeconds = Math.max(0, elapsedMs) / 1000;
  const frame = Math.floor(elapsedSeconds * clip.fps);

  if (clip.playback === "loop") {
    return frame % frameCount;
  }

  return Math.min(frame, frameCount - 1);
}

export function isAnimationComplete(
  clip: AnimationClipDefinition,
  elapsedMs: number,
) {
  if (clip.playback === "loop") {
    return false;
  }

  const elapsedSeconds = Math.max(0, elapsedMs) / 1000;
  const frame = Math.floor(elapsedSeconds * clip.fps);

  return frame >= Math.max(1, clip.frameCount);
}

export function getSpriteBackgroundPosition(
  clip: AnimationClipDefinition,
  frame: number,
) {
  const boundedFrame = Math.max(0, Math.min(frame, Math.max(1, clip.frameCount) - 1));

  return `-${boundedFrame * clip.frameWidth}px 0px`;
}

export function getAnimationDurationMs(clip: AnimationClipDefinition) {
  return Math.ceil((Math.max(1, clip.frameCount) / clip.fps) * 1000);
}
