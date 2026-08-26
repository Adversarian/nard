import { GEO } from './geometry'

/**
 * Shared SVG materials: wood, khatam inlay, checker turnings, shadows.
 *
 * Everything here is procedural — no image assets. Colours resolve from the
 * theme tokens in styles/theme.css, so the same defs serve all three themes.
 */
export function BoardDefs() {
  return (
    <defs>
      {/* --- wood ------------------------------------------------------- */}
      <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--frame-hi)" />
        <stop offset="0.35" stopColor="var(--frame)" />
        <stop offset="1" stopColor="var(--frame)" stopOpacity="0.82" />
      </linearGradient>

      {/* Grain: turbulence stretched horizontally reads as sawn timber. */}
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9 22" numOctaves="4" seed="7" />
        <feColorMatrix type="saturate" values="0" />
      </filter>

      {/* The bar sits between two raised halves, so it is in shadow — darker
          than the frame, and lit from neither end. Making it as bright as the
          case makes it read as a plank laid on top of the board. */}
      <linearGradient id="wood-bar" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="var(--frame)" stopOpacity="0.55" />
        <stop offset="0.5" stopColor="var(--frame)" stopOpacity="0.9" />
        <stop offset="1" stopColor="var(--frame)" stopOpacity="0.55" />
      </linearGradient>

      {/* Field: much finer, reads as felt rather than wood. */}
      <filter id="felt" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="14" numOctaves="3" seed="3" />
        <feColorMatrix type="saturate" values="0" />
      </filter>

      {/* --- khatam inlay ---------------------------------------------- */}
      {/*
        Alternating bone and ebony triangles separated by brass hairlines — the
        sawtooth band that edges a real khatam board. Two orientations so the
        band can run along all four sides of the frame.
      */}
      <pattern
        id="khatam-h"
        patternUnits="userSpaceOnUse"
        width={0.2}
        height={GEO.inlayW}
      >
        <rect width={0.2} height={GEO.inlayW} fill="var(--checker-dark)" />
        <polygon
          points={`0,${GEO.inlayW} 0.1,0 0.2,${GEO.inlayW}`}
          fill="var(--checker-light)"
        />
        <rect width={0.008} height={GEO.inlayW} fill="var(--inlay)" opacity="0.85" />
      </pattern>
      <pattern
        id="khatam-v"
        patternUnits="userSpaceOnUse"
        width={GEO.inlayW}
        height={0.2}
        patternTransform="rotate(90)"
      >
        <rect width={0.2} height={GEO.inlayW} fill="var(--checker-dark)" />
        <polygon
          points={`0,${GEO.inlayW} 0.1,0 0.2,${GEO.inlayW}`}
          fill="var(--checker-light)"
        />
        <rect width={0.008} height={GEO.inlayW} fill="var(--inlay)" opacity="0.85" />
      </pattern>

      {/* --- points ----------------------------------------------------- */}
      {/* A whisper of falloff toward the tip; flat colour reads as clip-art. */}
      <linearGradient id="point-a-top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--point-a)" />
        <stop offset="1" stopColor="var(--point-a)" stopOpacity="0.72" />
      </linearGradient>
      <linearGradient id="point-b-top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--point-b)" />
        <stop offset="1" stopColor="var(--point-b)" stopOpacity="0.72" />
      </linearGradient>
      <linearGradient id="point-a-bot" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="var(--point-a)" />
        <stop offset="1" stopColor="var(--point-a)" stopOpacity="0.72" />
      </linearGradient>
      <linearGradient id="point-b-bot" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="var(--point-b)" />
        <stop offset="1" stopColor="var(--point-b)" stopOpacity="0.72" />
      </linearGradient>

      {/* --- checkers --------------------------------------------------- */}
      {/* Light source upper-left, consistently with every shadow in the app. */}
      <radialGradient id="checker-light" cx="0.36" cy="0.30" r="0.78">
        <stop offset="0" stopColor="var(--checker-light)" />
        <stop offset="0.55" stopColor="var(--checker-light)" />
        <stop offset="1" stopColor="var(--checker-light-edge)" />
      </radialGradient>
      <radialGradient id="checker-dark" cx="0.36" cy="0.30" r="0.82">
        <stop offset="0" stopColor="var(--checker-dark-hi)" />
        <stop offset="0.5" stopColor="var(--checker-dark)" />
        <stop offset="1" stopColor="var(--checker-dark)" />
      </radialGradient>

      <filter id="checker-shadow" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0.018" dy="0.05" stdDeviation="0.032" floodOpacity="0.6" />
      </filter>
      <filter id="board-shadow" x="-15%" y="-15%" width="130%" height="140%">
        <feDropShadow dx="0" dy="0.18" stdDeviation="0.32" floodOpacity="0.55" />
      </filter>

      {/* Edges: a bright top lip and a dark base, so raised parts of the case
          (the bar, the tray divider) read as raised rather than painted on. */}
      <linearGradient id="edge-h" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0.55" />
        <stop offset="0.14" stopColor="#000" stopOpacity="0" />
        <stop offset="0.86" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.55" />
      </linearGradient>
      <linearGradient id="well" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.6" />
        <stop offset="0.16" stopColor="#000" stopOpacity="0.12" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </linearGradient>

      {/* Inner shadow for the field, so the playing surface sits *inside* the case. */}
      <filter id="inset" x="-20%" y="-20%" width="140%" height="140%">
        <feOffset dx="0" dy="0.03" />
        <feGaussianBlur stdDeviation="0.05" result="o" />
        <feComposite in="SourceGraphic" in2="o" operator="out" result="i" />
        <feColorMatrix in="i" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0" />
      </filter>
    </defs>
  )
}
