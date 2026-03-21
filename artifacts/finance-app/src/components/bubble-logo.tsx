interface BubbleLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { circle: 28, fontSize: "text-base", gap: "gap-2" },
  md: { circle: 36, fontSize: "text-xl",   gap: "gap-3" },
  lg: { circle: 48, fontSize: "text-3xl",  gap: "gap-3.5" },
};

export function BubbleLogo({
  size = "md",
  showText = true,
  className = "",
}: BubbleLogoProps) {
  const { circle, fontSize, gap } = sizes[size];
  const r = circle / 2;

  return (
    <div className={`flex items-center ${gap} ${className}`}>
      {/* SVG bubble icon */}
      <svg
        width={circle}
        height={circle}
        viewBox={`0 0 ${circle} ${circle}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient
            id="bubble-gradient"
            cx="38%"
            cy="32%"
            r="65%"
            fx="38%"
            fy="32%"
          >
            <stop offset="0%"   stopColor="#82D8FA" />
            <stop offset="55%"  stopColor="#4FC3F7" />
            <stop offset="100%" stopColor="#039BE5" />
          </radialGradient>

          <radialGradient
            id="bubble-shine"
            cx="35%"
            cy="28%"
            r="45%"
          >
            <stop offset="0%"  stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>

          <filter id="bubble-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy={circle * 0.06}
              stdDeviation={circle * 0.09}
              floodColor="#4FC3F7"
              floodOpacity="0.40"
            />
          </filter>
        </defs>

        {/* Main bubble */}
        <circle
          cx={r}
          cy={r}
          r={r - 1}
          fill="url(#bubble-gradient)"
          filter="url(#bubble-shadow)"
        />

        {/* Specular shine */}
        <circle
          cx={r}
          cy={r}
          r={r - 1}
          fill="url(#bubble-shine)"
        />

        {/* Small highlight dot */}
        <circle
          cx={r * 0.58}
          cy={r * 0.50}
          r={r * 0.16}
          fill="white"
          opacity="0.70"
        />
      </svg>

      {showText && (
        <span
          className={`font-display font-bold tracking-tight text-foreground leading-none ${fontSize}`}
        >
          Bubble
        </span>
      )}
    </div>
  );
}
