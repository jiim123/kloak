import { forwardRef, useMemo } from "react";
import { Uniform, Vector2, Color } from "three";
import { Effect } from "postprocessing";

const fragmentShader = /* glsl */ `
uniform vec3 uColorBackground;
uniform vec3 uColorForeground;
uniform float uDotSize;
uniform float uContrast;
uniform float uSpread;
uniform vec2 uResolution;

float halftonePattern(vec2 uv, float angle, float scale) {
  float s = sin(angle);
  float c = cos(angle);
  vec2 rotUV = vec2(
    uv.x * c - uv.y * s,
    uv.x * s + uv.y * c
  );
  return (sin(rotUV.x * scale) * sin(rotUV.y * scale)) * 0.5 + 0.5;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Convert to luminance
  float luma = dot(inputColor.rgb, vec3(0.299, 0.587, 0.114));

  // Apply contrast
  luma = (luma - 0.5) * uContrast + 0.5;
  luma = clamp(luma, 0.0, 1.0);

  // Halftone pattern
  vec2 pixelCoord = uv * uResolution;
  float dotScale = 3.14159 / (uDotSize * 0.5 + 0.001);
  float angle = 0.7333 * 3.14159; // ~132 degrees from URL param mhrd

  float pattern = halftonePattern(pixelCoord, angle, dotScale);

  // Spread controls the sharpness of the dot edges
  float threshold = smoothstep(
    luma - uSpread,
    luma + uSpread,
    pattern
  );

  // Mix colors
  vec3 color = mix(uColorForeground, uColorBackground, threshold);

  outputColor = vec4(color, inputColor.a);
}
`;

type HalftoneMonoEffectOptions = {
  colorBackground?: Color;
  colorForeground?: Color;
  dotSize?: number;
  contrast?: number;
  spread?: number;
  resolution?: Vector2;
};

class HalftoneMonoEffectImpl extends Effect {
  constructor({
    colorBackground = new Color("#dbd6cc"),
    colorForeground = new Color("#050505"),
    dotSize = 1.35,
    contrast = 1.35,
    spread = 0.48,
    resolution = new Vector2(1920, 1080),
  }: HalftoneMonoEffectOptions = {}) {
    super("HalftoneMonoEffect", fragmentShader, {
      uniforms: new Map<string, Uniform<unknown>>([
        ["uColorBackground", new Uniform(colorBackground)],
        ["uColorForeground", new Uniform(colorForeground)],
        ["uDotSize", new Uniform(dotSize)],
        ["uContrast", new Uniform(contrast)],
        ["uSpread", new Uniform(spread)],
        ["uResolution", new Uniform(resolution)],
      ]),
    });
  }
}

type HalftoneMonoProps = {
  colorBackground?: string;
  colorForeground?: string;
  dotSize?: number;
  contrast?: number;
  spread?: number;
};

export const HalftoneMonoEffect = forwardRef<Effect, HalftoneMonoProps>(
  (
    {
      colorBackground = "#dbd6cc",
      colorForeground = "#050505",
      dotSize = 1.35,
      contrast = 1.35,
      spread = 0.48,
    },
    ref
  ) => {
    const effect = useMemo(
      () =>
        new HalftoneMonoEffectImpl({
          colorBackground: new Color(colorBackground),
          colorForeground: new Color(colorForeground),
          dotSize,
          contrast,
          spread,
        }),
      [colorBackground, colorForeground, dotSize, contrast, spread]
    );

    return <primitive ref={ref} object={effect} dispose={null} />;
  }
);

HalftoneMonoEffect.displayName = "HalftoneMonoEffect";
