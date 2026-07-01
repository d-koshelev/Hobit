import type {
  ActionOffset,
  RuntimeSceneObject,
  TrackEasing,
  TrackPoint,
  VisualTrack,
} from "./contracts";

export function applyEasing(progress: number, easing: TrackEasing = "linear") {
  const bounded = Math.max(0, Math.min(1, progress));

  switch (easing) {
    case "easeIn":
      return bounded * bounded;
    case "easeOut":
      return 1 - (1 - bounded) * (1 - bounded);
    case "easeInOut":
      return bounded < 0.5
        ? 2 * bounded * bounded
        : 1 - Math.pow(-2 * bounded + 2, 2) / 2;
    case "linear":
      return bounded;
  }
}

export function getTrackProgress(track: VisualTrack, timeMs: number) {
  if (track.durationMs <= 0) {
    return timeMs >= track.startTimeMs ? 1 : 0;
  }

  return Math.max(
    0,
    Math.min(1, (timeMs - track.startTimeMs) / track.durationMs),
  );
}

export function interpolateNumber(
  from: number,
  to: number,
  progress: number,
  easing: TrackEasing = "linear",
) {
  const eased = applyEasing(progress, easing);

  return from + (to - from) * eased;
}

export function sampleMoveToTrack(track: VisualTrack, timeMs: number) {
  const progress = getTrackProgress(track, timeMs);

  return {
    x: interpolateNumber(
      track.from?.x ?? 0,
      track.to?.x ?? track.from?.x ?? 0,
      progress,
      track.easing,
    ),
    y: interpolateNumber(
      track.from?.y ?? 0,
      track.to?.y ?? track.from?.y ?? 0,
      progress,
      track.easing,
    ),
  };
}

function getSegmentLength(from: TrackPoint, to: TrackPoint) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function sampleMoveAlongPathTrack(track: VisualTrack, timeMs: number) {
  const path = track.path ?? [];

  if (path.length === 0) {
    return { x: track.from?.x ?? 0, y: track.from?.y ?? 0 };
  }

  if (path.length === 1) {
    return path[0];
  }

  const progress = applyEasing(getTrackProgress(track, timeMs), track.easing);
  const segmentLengths = path.slice(1).map((point, index) =>
    getSegmentLength(path[index], point),
  );
  const totalLength = segmentLengths.reduce((total, length) => total + length, 0);

  if (totalLength <= 0) {
    return path[path.length - 1];
  }

  let remaining = totalLength * progress;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];

    if (remaining <= segmentLength) {
      const localProgress = segmentLength <= 0 ? 1 : remaining / segmentLength;
      const from = path[index];
      const to = path[index + 1];

      return {
        x: interpolateNumber(from.x, to.x, localProgress),
        y: interpolateNumber(from.y, to.y, localProgress),
      };
    }

    remaining -= segmentLength;
  }

  return path[path.length - 1];
}

export function sampleOrbitTrack(
  track: VisualTrack,
  timeMs: number,
  targetObject: RuntimeSceneObject | undefined,
) {
  const progress = getTrackProgress(track, timeMs);
  const rotations = track.speed ?? 1;
  const angle = progress * rotations * Math.PI * 2;
  const radius = track.radius ?? 8;
  const offset = track.offset ?? {};

  return {
    x: (targetObject?.x ?? 50) + (offset.x ?? 0) + Math.cos(angle) * radius,
    y: (targetObject?.y ?? 50) + (offset.y ?? 0) + Math.sin(angle) * radius,
  };
}

export function samplePropertyTrack(track: VisualTrack, timeMs: number) {
  const property = track.property;

  if (!property) {
    return {};
  }

  return {
    [property]: interpolateNumber(
      track.from?.[property] ?? 0,
      track.to?.[property] ?? track.from?.[property] ?? 0,
      getTrackProgress(track, timeMs),
      track.easing,
    ),
  };
}

export function applyAttachment(
  baseObject: RuntimeSceneObject,
  targetObject: RuntimeSceneObject,
  offset: ActionOffset = { x: 0, y: 0 },
) {
  return {
    ...baseObject,
    x: targetObject.x + (offset.x ?? 0),
    y: targetObject.y + (offset.y ?? 0),
  };
}

export function isTrackVisibleAtTime(track: VisualTrack, timeMs: number) {
  if (timeMs < track.startTimeMs) {
    return false;
  }

  if (track.persistent) {
    return true;
  }

  return timeMs <= track.startTimeMs + track.durationMs;
}
