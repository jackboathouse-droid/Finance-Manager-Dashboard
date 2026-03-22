interface BubbleLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const SIZES = {
  sm: { bubbleSize: 32, fontSize: 20, overlap: 22 },
  md: { bubbleSize: 44, fontSize: 27, overlap: 30 },
  lg: { bubbleSize: 62, fontSize: 38, overlap: 42 },
} as const;

function GlassBubbleSvg({ px, uid }: { px: number; uid: string }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      <defs>
        {/* Soft outer halo */}
        <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4FC3F7" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#4FC3F7" stopOpacity="0" />
        </radialGradient>

        {/* Glass body — nearly transparent, faint cool blue tint */}
        <radialGradient id={`${uid}-fill`} cx="36%" cy="28%" r="72%">
          <stop offset="0%"   stopColor="#E1F5FE" stopOpacity="0.72" />
          <stop offset="50%"  stopColor="#B3E5FC" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#81D4FA" stopOpacity="0.08" />
        </radialGradient>

        {/* Rim — gradient stroke from bright white (top-left) to faint blue (bottom-right) */}
        <linearGradient id={`${uid}-rim`} x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%"   stopColor="white"   stopOpacity="0.96" />
          <stop offset="42%"  stopColor="#B3E5FC" stopOpacity="0.70" />
          <stop offset="100%" stopColor="#4FC3F7"  stopOpacity="0.22" />
        </linearGradient>

        {/* Main specular highlight (large, upper-left) */}
        <radialGradient id={`${uid}-spec`} cx="30%" cy="22%" r="52%">
          <stop offset="0%"   stopColor="white" stopOpacity="0.98" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>

        {/* Secondary lower-right internal reflection */}
        <radialGradient id={`${uid}-refl`} cx="63%" cy="70%" r="36%">
          <stop offset="0%"   stopColor="#B3E5FC" stopOpacity="0.52" />
          <stop offset="100%" stopColor="#B3E5FC" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Outer glow halo (larger than the bubble, very blurred feel) */}
      <circle cx="50" cy="50" r="54" fill={`url(#${uid}-glow)`} />

      {/* Glass body */}
      <circle cx="50" cy="50" r="44" fill={`url(#${uid}-fill)`} />

      {/* Rim highlight stroke */}
      <circle cx="50" cy="50" r="44" stroke={`url(#${uid}-rim)`} strokeWidth="2.5" />

      {/* Large upper-left specular ellipse — the main "liquid glass" reflection */}
      <ellipse
        cx="34" cy="30" rx="22" ry="14"
        fill={`url(#${uid}-spec)`}
        transform="rotate(-22 34 30)"
      />

      {/* Bright elongated catchlight — feels like a window reflection */}
      <ellipse
        cx="27" cy="23" rx="9" ry="5.5"
        fill="white" opacity="0.90"
        transform="rotate(-30 27 23)"
      />

      {/* Tiny bright specular dot — the "sparkle" */}
      <circle cx="22" cy="18" r="4" fill="white" />

      {/* Micro dot at peak */}
      <circle cx="19" cy="15" r="1.8" fill="white" opacity="0.70" />

      {/* Lower-right secondary reflection — subtle blue sheen */}
      <ellipse cx="63" cy="66" rx="17" ry="10" fill={`url(#${uid}-refl)`} />

      {/* Inner rim line — gives a sense of glass thickness */}
      <circle
        cx="50" cy="50" r="40"
        stroke="white" strokeWidth="0.8" strokeOpacity="0.14"
      />
    </svg>
  );
}

export function BubbleLogo({
  size = "md",
  showText = true,
  className = "",
}: BubbleLogoProps) {
  const { bubbleSize, fontSize, overlap } = SIZES[size];
  const uid = `bbl-${size}`;

  if (!showText) {
    return (
      <div className={className}>
        <GlassBubbleSvg px={bubbleSize} uid={uid} />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center ${className}`}>
      {/*
       * Glass bubble — rendered first in DOM but on top via z-index.
       * The negative right margin pulls the text leftward so the "B"
       * sits beneath the right portion of the bubble.
       */}
      <div
        style={{
          flexShrink: 0,
          position: "relative",
          zIndex: 1,
          marginRight: `-${overlap}px`,
        }}
      >
        <GlassBubbleSvg px={bubbleSize} uid={uid} />
      </div>

      {/* Script wordmark — the "B" is partially under the glass bubble */}
      <span
        style={{
          fontFamily: "'Pacifico', cursive",
          fontSize: `${fontSize}px`,
          lineHeight: 1,
          color: "#1C3A5E",
          whiteSpace: "nowrap",
          letterSpacing: "0px",
        }}
      >
        Bubble
      </span>
    </div>
  );
}
