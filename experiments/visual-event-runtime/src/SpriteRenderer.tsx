import { useState, type CSSProperties } from "react";
import {
  getAnimationFrame,
  getSpriteBackgroundPosition,
  isAnimationComplete,
} from "./animationRuntime";
import type {
  AnimationClipDefinition,
  SpriteSheetAssetDefinition,
} from "./contracts";

type SpriteRendererProps = {
  asset: SpriteSheetAssetDefinition;
  clip: AnimationClipDefinition;
  elapsedMs: number;
  className?: string;
  displayWidth?: number;
  fallbackAsset?: SpriteSheetAssetDefinition;
  label?: string;
  onAssetMissing?: (asset: SpriteSheetAssetDefinition) => void;
};

function SpriteRenderer({
  asset,
  clip,
  elapsedMs,
  className,
  displayWidth,
  fallbackAsset,
  label,
  onAssetMissing,
}: SpriteRendererProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const isMissing = failedSrc === asset.src;
  const activeAsset = isMissing && fallbackAsset ? fallbackAsset : asset;
  const activeClip = {
    ...clip,
    frameWidth: activeAsset.frameWidth,
    frameHeight: activeAsset.frameHeight,
    frameCount: activeAsset.frameCount,
  };
  const frame = getAnimationFrame(activeClip, elapsedMs);
  const completed = isAnimationComplete(activeClip, elapsedMs);
  const columns = activeAsset.columns ?? activeAsset.frameCount;
  const rows = activeAsset.rows ?? Math.ceil(activeAsset.frameCount / columns);
  const scale = displayWidth ? displayWidth / activeClip.frameWidth : 1;

  const style = {
    "--sprite-display-width": `${activeClip.frameWidth * scale}px`,
    "--sprite-display-height": `${activeClip.frameHeight * scale}px`,
    "--sprite-width": `${activeClip.frameWidth}px`,
    "--sprite-height": `${activeClip.frameHeight}px`,
    "--sprite-scale": scale,
  } as CSSProperties;

  const frameStyle = {
    backgroundImage: `url(${activeAsset.src})`,
    backgroundPosition: getSpriteBackgroundPosition(activeClip, frame),
    backgroundSize: `${columns * activeAsset.frameWidth}px ${rows * activeAsset.frameHeight}px`,
  } as CSSProperties;

  return (
    <div
      aria-label={label ?? `${clip.id} frame ${frame}`}
      className={["sprite-renderer", className].filter(Boolean).join(" ")}
      data-complete={completed ? "true" : "false"}
      data-frame={frame}
      data-missing={isMissing ? "true" : "false"}
      role="img"
      style={style}
    >
      <img
        alt=""
        aria-hidden="true"
        className="sprite-preload"
        onError={() => {
          setFailedSrc(asset.src);
          onAssetMissing?.(asset);
        }}
        onLoad={() => setFailedSrc(null)}
        src={asset.src}
      />
      <span className="sprite-frame" style={frameStyle} />
      {isMissing ? <span className="sprite-warning">fallback</span> : null}
    </div>
  );
}

export default SpriteRenderer;
