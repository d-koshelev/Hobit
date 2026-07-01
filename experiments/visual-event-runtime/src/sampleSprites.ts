type FrameRenderer = (frame: number, width: number, height: number) => string;

const frameWidth = 64;
const frameHeight = 64;

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function buildSpriteSheet(frameCount: number, renderFrame: FrameRenderer) {
  const width = frameWidth * frameCount;
  const frames = Array.from({ length: frameCount }, (_, frame) => {
    const x = frame * frameWidth;

    return `<g transform="translate(${x} 0)">${renderFrame(frame, frameWidth, frameHeight)}</g>`;
  }).join("");

  return svgToDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${frameHeight}" viewBox="0 0 ${width} ${frameHeight}">${frames}</svg>`,
  );
}

function baseFrame(fill = "transparent") {
  return `<rect width="${frameWidth}" height="${frameHeight}" fill="${fill}"/>`;
}

function wake(frame: number, y = 48) {
  const offset = frame % 3;

  return [
    `<path d="M8 ${y + offset} C19 ${y - 4} 29 ${y + 4} 42 ${y}" fill="none" stroke="#7bc3dc" stroke-width="1.4" stroke-linecap="round" opacity="0.42"/>`,
    `<path d="M10 ${y + 7 - offset} C23 ${y + 3} 33 ${y + 9} 50 ${y + 5}" fill="none" stroke="#bfefff" stroke-width="1" stroke-linecap="round" opacity="0.28"/>`,
  ].join("");
}

function carrierDeck(frame: number, scale = 1) {
  const bob = frame % 2 === 0 ? 0 : 0.7;
  const runwayGlow = 0.52 + (frame % 3) * 0.08;

  return [
    wake(frame, 50),
    `<g transform="translate(0 ${bob}) scale(${scale})">`,
    `<path d="M7 34 L15 22 L50 18 L59 28 L56 40 L17 45 Z" fill="#2d4654" stroke="#9bc6d2" stroke-width="2"/>`,
    `<path d="M17 27 L48 23 L54 30 L49 36 L18 40 L12 34 Z" fill="#526b74" stroke="#d7eef3" stroke-width="1.2"/>`,
    `<path d="M19 35 L48 26" stroke="#f4e6b2" stroke-width="2" stroke-linecap="round" opacity="${runwayGlow}"/>`,
    `<path d="M23 30 L33 27" stroke="#f8fbff" stroke-width="1" stroke-linecap="round" opacity="0.72"/>`,
    `<rect x="39" y="19" width="8" height="8" rx="1.5" fill="#223640" stroke="#a7cbd4" stroke-width="1"/>`,
    `<rect x="43" y="17" width="5" height="3" rx="1" fill="#d8edf1"/>`,
    `<path d="M26 36 l5 -2 l-2 4 z" fill="#dceaf2" opacity="0.82"/>`,
    `<path d="M35 26 l5 -2 l-2 4 z" fill="#dceaf2" opacity="0.7"/>`,
    `</g>`,
  ].join("");
}

function shipHull(frame: number, fill: string, stroke: string, deck = "#d2e4df") {
  const bob = frame % 2 === 0 ? -0.5 : 0.5;

  return [
    wake(frame, 49),
    `<g transform="translate(0 ${bob})">`,
    `<path d="M11 36 L18 25 H47 L55 35 L48 44 H18 Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`,
    `<rect x="24" y="27" width="17" height="7" rx="2" fill="${deck}" opacity="0.84"/>`,
    `<rect x="29" y="21" width="11" height="6" rx="1.5" fill="#f0f8f5" opacity="0.78"/>`,
    `<circle cx="19" cy="38" r="2" fill="#d7fff0" opacity="0.72"/>`,
    `<circle cx="47" cy="36" r="2" fill="#d7fff0" opacity="0.72"/>`,
    `</g>`,
  ].join("");
}

export const spriteSheetSources = {
  coordinatorCarrierIdle: buildSpriteSheet(6, (frame) => [
    baseFrame(),
    carrierDeck(frame, 1),
  ].join("")),

  queueCarrierIdle: buildSpriteSheet(6, (frame) => {
    const glow = 0.44 + (frame % 3) * 0.08;

    return [
      baseFrame(),
      wake(frame, 51),
      `<g transform="translate(0 ${frame % 2 === 0 ? 0 : 0.5})">`,
      `<path d="M10 36 L17 25 L48 23 L56 32 L50 43 L18 43 Z" fill="#3f4f54" stroke="#b9d5d9" stroke-width="2"/>`,
      `<path d="M18 31 H47 L51 35 L46 39 H18 Z" fill="#65757a"/>`,
      `<path d="M20 35 H45" stroke="#f4d16f" stroke-width="2" stroke-linecap="round" opacity="${glow}"/>`,
      `<path d="M36 28 h8 v5 h-8z" fill="#253941" stroke="#a9c7ca" stroke-width="1"/>`,
      `<path d="M23 37 l6 -3 l-2 5 z" fill="#eaf5f7" opacity="0.8"/>`,
      `</g>`,
    ].join("");
  }),

  fighterFlying: buildSpriteSheet(6, (frame) => {
    const bob = frame % 2 === 0 ? -1.5 : 1.5;
    const flame = 6 + (frame % 3) * 2;

    return [
      baseFrame(),
      `<g transform="translate(0 ${bob})">`,
      `<path d="M49 32 L20 18 L25 29 L9 25 L23 34 L9 41 L25 36 L20 47 Z" fill="#dcebf1" stroke="#6c9fb4" stroke-width="2" stroke-linejoin="round"/>`,
      `<path d="M22 32 L${10 - frame} ${32 - flame / 2} L14 32 L${10 - frame} ${32 + flame / 2} Z" fill="#ffb84a" opacity="0.9"/>`,
      `<path d="M37 29 l8 3 l-8 3 z" fill="#78e5ff" opacity="0.75"/>`,
      `<circle cx="${46 + frame * 0.5}" cy="${27 + bob * 0.25}" r="2" fill="#f8feff"/>`,
      `</g>`,
    ].join("");
  }),

  dbShipHealthy: buildSpriteSheet(6, (frame) => [
    baseFrame(),
    shipHull(frame, "#2f7d5b", "#bde8c9", "#d7f3e4"),
    `<circle cx="32" cy="39" r="${3 + (frame % 3)}" fill="#74f4a6" opacity="0.22"/>`,
  ].join("")),

  dbShipDown: buildSpriteSheet(6, (frame) => {
    const drift = frame * 2;

    return [
      baseFrame(),
      shipHull(frame, "#51433e", "#d27463", "#9a847c"),
      `<path d="M18 31 L28 40 L35 29 L47 42" stroke="#ff8b65" stroke-width="2.8" fill="none" stroke-linecap="round"/>`,
      `<ellipse cx="${24 + drift}" cy="${22 - frame}" rx="${7 + frame}" ry="6" fill="#85908b" opacity="0.58"/>`,
      `<ellipse cx="${38 - frame}" cy="${15 - frame}" rx="${7 + frame}" ry="6" fill="#b9c1bd" opacity="0.36"/>`,
      `<circle cx="${28 + frame}" cy="30" r="3" fill="#ffba55" opacity="${0.55 + (frame % 2) * 0.2}"/>`,
    ].join("");
  }),

  dbShipRecovering: buildSpriteSheet(6, (frame) => {
    const dash = frame * 2;

    return [
      baseFrame(),
      `<ellipse cx="32" cy="36" rx="27" ry="16" fill="none" stroke="#78f1b0" stroke-width="2" stroke-dasharray="5 4" stroke-dashoffset="${dash}" opacity="0.72"/>`,
      shipHull(frame, "#376b66", "#c7f4e5", "#d9fff1"),
      `<path d="M29 20 h6 v8 h8 v6 h-8 v8 h-6 v-8 h-8 v-6 h8z" fill="#eafff1" stroke="#3bbd72" stroke-width="1.5" opacity="${0.64 + (frame % 3) * 0.08}"/>`,
    ].join("");
  }),

  supportShipHealthy: buildSpriteSheet(6, (frame) => [
    baseFrame(),
    shipHull(frame, "#315a75", "#bcd8ea", "#dbeaf2"),
    `<path d="M23 41 H44" stroke="#89ccff" stroke-width="1.5" opacity="0.54"/>`,
  ].join("")),

  codebaseTarget: buildSpriteSheet(6, (frame) => {
    const radius = 10 + (frame % 3) * 3;

    return [
      baseFrame(),
      `<path d="M11 42 C18 29 22 23 33 23 C43 23 51 30 54 42 C44 49 24 51 11 42 Z" fill="#537b5c" stroke="#b9dfaf" stroke-width="2"/>`,
      `<rect x="24" y="27" width="18" height="13" rx="2" fill="#31464a" stroke="#d9eef2" stroke-width="1.5"/>`,
      `<path d="M27 40 H46 L50 45 H19 L23 40 Z" fill="#6f7f6e" stroke="#d8e6c4" stroke-width="1"/>`,
      `<circle cx="33" cy="32" r="${radius}" fill="none" stroke="#8fe8ff" stroke-width="1.6" opacity="${0.58 - (frame % 3) * 0.1}"/>`,
      `<circle cx="33" cy="32" r="4" fill="#e8fbff"/>`,
      `<path d="M33 20 V13 M29 15 H37" stroke="#e8fbff" stroke-width="1.6" stroke-linecap="round"/>`,
    ].join("");
  }),

  scannerDrone: buildSpriteSheet(8, (frame) => {
    const sweepX = 31 + Math.cos(frame * 0.78) * 17;
    const sweepY = 32 + Math.sin(frame * 0.78) * 17;
    const pulse = 0.5 + (frame % 4) * 0.08;

    return [
      baseFrame(),
      `<circle cx="18" cy="20" r="7" fill="none" stroke="#a5f2ff" stroke-width="2" opacity="${pulse}"/>`,
      `<circle cx="46" cy="20" r="7" fill="none" stroke="#a5f2ff" stroke-width="2" opacity="${pulse}"/>`,
      `<circle cx="18" cy="44" r="7" fill="none" stroke="#a5f2ff" stroke-width="2" opacity="${pulse}"/>`,
      `<circle cx="46" cy="44" r="7" fill="none" stroke="#a5f2ff" stroke-width="2" opacity="${pulse}"/>`,
      `<path d="M22 23 L32 32 L42 23 M22 41 L32 32 L42 41" stroke="#77c6d9" stroke-width="2" stroke-linecap="round"/>`,
      `<rect x="25" y="25" width="14" height="14" rx="4" fill="#dffbff" stroke="#4ea4ba" stroke-width="2"/>`,
      `<line x1="32" y1="32" x2="${sweepX.toFixed(2)}" y2="${sweepY.toFixed(2)}" stroke="#94e7ff" stroke-width="2" stroke-linecap="round"/>`,
      `<circle cx="32" cy="32" r="3" fill="#1e7589"/>`,
    ].join("");
  }),

  scanRing: buildSpriteSheet(8, (frame) => {
    const radius = 9 + frame * 3;

    return [
      baseFrame(),
      `<circle cx="32" cy="32" r="${radius}" fill="none" stroke="#76dcff" stroke-width="3" opacity="${0.82 - frame * 0.07}"/>`,
      `<circle cx="32" cy="32" r="${radius + 8}" fill="none" stroke="#d0f7ff" stroke-width="1.5" opacity="${0.42 - frame * 0.035}"/>`,
      `<line x1="32" y1="32" x2="${32 + Math.cos(frame * 0.78) * 24}" y2="${32 + Math.sin(frame * 0.78) * 24}" stroke="#bdf5ff" stroke-width="2" stroke-linecap="round"/>`,
      `<circle cx="32" cy="32" r="3.5" fill="#e8fbff"/>`,
    ].join("");
  }),

  explosion: buildSpriteSheet(8, (frame) => {
    const radius = 8 + frame * 3.4;
    const opacity = Math.max(0.18, 0.94 - frame * 0.1);

    return [
      baseFrame(),
      `<path d="M32 5 L38 23 L58 17 L43 34 L55 57 L32 45 L10 57 L21 34 L6 17 L26 23 Z" fill="#ff7a3d" opacity="${opacity}"/>`,
      `<circle cx="32" cy="32" r="${radius}" fill="#ffd05a" opacity="${opacity * 0.78}"/>`,
      `<circle cx="32" cy="32" r="${Math.max(4, radius - 10)}" fill="#fff4c8" opacity="${opacity}"/>`,
      `<path d="M23 18 L41 47 M45 19 L20 43" stroke="#fff2b3" stroke-width="2" stroke-linecap="round" opacity="${opacity}"/>`,
    ].join("");
  }),

  smokeLoop: buildSpriteSheet(6, (frame) => {
    const drift = frame * 2.4;

    return [
      baseFrame(),
      `<ellipse cx="${22 + drift}" cy="${47 - frame * 2}" rx="${11 + frame}" ry="8" fill="#69746f" opacity="0.68"/>`,
      `<ellipse cx="${36 - frame}" cy="${38 - frame * 3}" rx="${10 + frame}" ry="9" fill="#9ba39f" opacity="0.5"/>`,
      `<ellipse cx="${28 + frame}" cy="${27 - frame * 2}" rx="${8 + frame}" ry="7" fill="#c4cac6" opacity="0.32"/>`,
      `<ellipse cx="${42 + frame * 0.5}" cy="${25 - frame}" rx="7" ry="5" fill="#e0e4e1" opacity="0.18"/>`,
    ].join("");
  }),

  repairDock: buildSpriteSheet(6, (frame) => {
    const dash = frame * 3;
    const sweep = 12 + frame * 7;

    return [
      baseFrame(),
      `<circle cx="32" cy="34" r="24" fill="none" stroke="#72efaa" stroke-width="2.5" stroke-dasharray="6 5" stroke-dashoffset="${dash}" opacity="0.76"/>`,
      `<path d="M13 26 V18 H25 M51 26 V18 H39 M13 42 V50 H25 M51 42 V50 H39" fill="none" stroke="#e6fff0" stroke-width="2" stroke-linecap="round"/>`,
      `<circle cx="${sweep}" cy="${50 - frame * 6}" r="3.8" fill="#fff2a5"/>`,
      `<path d="M29 22 h6 v9 h9 v6 h-9 v9 h-6 v-9 h-9 v-6 h9z" fill="#eafff1" stroke="#3bbd72" stroke-width="1.5" opacity="${0.58 + frame * 0.05}"/>`,
    ].join("");
  }),

  oilRig: buildSpriteSheet(6, (frame) => {
    const beacon = 0.38 + (frame % 3) * 0.18;

    return [
      baseFrame(),
      `<ellipse cx="32" cy="49" rx="24" ry="5" fill="#79d4ea" opacity="0.22"/>`,
      `<path d="M17 39 H48 L44 45 H20 Z" fill="#59676a" stroke="#d6e3df" stroke-width="1.5"/>`,
      `<path d="M21 45 L17 58 M43 45 L47 58 M29 45 L27 58 M35 45 L37 58" stroke="#b5c7c3" stroke-width="2" stroke-linecap="round"/>`,
      `<path d="M28 39 L38 16 L48 39 M33 27 H43 M30 34 H46" fill="none" stroke="#edf5f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
      `<rect x="18" y="31" width="11" height="8" rx="1.5" fill="#2f4145" stroke="#c8d7d3" stroke-width="1"/>`,
      `<circle cx="38" cy="15" r="4" fill="#ffd76b" opacity="${beacon}"/>`,
    ].join("");
  }),
};

export const generatedFrameSize = {
  width: frameWidth,
  height: frameHeight,
};
