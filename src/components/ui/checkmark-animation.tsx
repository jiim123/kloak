import { useEffect, useState } from "react";

interface CheckmarkAnimationProps {
  size?: number;
}

export const CheckmarkAnimation = ({ size = 120 }: CheckmarkAnimationProps) => {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const r = size / 2;
  const strokeWidth = size * 0.06;
  const circleR = r - strokeWidth;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      className="block"
    >
      {/* Circle */}
      <circle
        cx={r}
        cy={r}
        r={circleR}
        stroke="hsl(var(--primary))"
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        style={{
          strokeDasharray: 2 * Math.PI * circleR,
          strokeDashoffset: animate ? 0 : 2 * Math.PI * circleR,
          transition: "stroke-dashoffset 0.6s ease-out",
        }}
      />
      {/* Checkmark */}
      <polyline
        points={`${size * 0.3},${size * 0.52} ${size * 0.45},${size * 0.65} ${size * 0.7},${size * 0.38}`}
        stroke="hsl(var(--primary))"
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: size,
          strokeDashoffset: animate ? 0 : size,
          transition: "stroke-dashoffset 0.4s ease-out 0.4s",
        }}
      />
    </svg>
  );
};
