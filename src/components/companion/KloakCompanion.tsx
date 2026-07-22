import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";

type CompanionMode = "idle" | "walk" | "sleep" | "drag" | "fall" | "hurt";

type Point = {
  x: number;
  y: number;
};

type PointerSample = Point & {
  time: number;
};

const COMPANION_WIDTH = 96;
const COMPANION_HEIGHT = 96;
const FLOOR_GAP = 8;
const WALL_GAP = 10;
const GRAVITY = 2600;
const HARD_LANDING_SPEED = 1120;
const THROW_DEAD_ZONE = 420;
const THROW_DAMPING = 0.24;
const POSITION_STORAGE_KEY = "kloak:companion-position";
const COMPANION_SPRITES: Record<CompanionMode, { url: string; frames: number; frameMs: number; footDrop: number }> = {
  idle: { url: "/companion/BunnyIdle-Sheet.png", frames: 8, frameMs: 140, footDrop: 15 },
  walk: { url: "/companion/BunnyRun-Sheet.png", frames: 5, frameMs: 78, footDrop: 15 },
  sleep: { url: "/companion/BunnySleep-Sheet.png", frames: 2, frameMs: 420, footDrop: 0 },
  drag: { url: "/companion/BunnyAttack-Sheet.png", frames: 7, frameMs: 58, footDrop: 0 },
  fall: { url: "/companion/BunnyIdle-Sheet.png", frames: 8, frameMs: 120, footDrop: 15 },
  hurt: { url: "/companion/BunnyDead-Sheet.png", frames: 9, frameMs: 140, footDrop: 0 },
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function getBounds() {
  if (typeof window === "undefined") {
    return { maxX: 0, floorY: 0 };
  }

  return {
    maxX: Math.max(WALL_GAP, window.innerWidth - COMPANION_WIDTH - WALL_GAP),
    floorY: Math.max(FLOOR_GAP, window.innerHeight - COMPANION_HEIGHT - FLOOR_GAP),
  };
}

function getInitialPosition(): Point {
  const bounds = getBounds();

  try {
    const stored = window.localStorage.getItem(POSITION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Point>;
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        return {
          x: clamp(parsed.x, WALL_GAP, bounds.maxX),
          y: clamp(parsed.y, FLOOR_GAP, bounds.floorY),
        };
      }
    }
  } catch {
    // Fall back to the default corner if localStorage is unavailable or malformed.
  }

  return {
    x: Math.max(WALL_GAP, bounds.maxX - 48),
    y: bounds.floorY,
  };
}

export function KloakCompanion() {
  const [position, setPosition] = useState<Point>(() => getInitialPosition());
  const [mode, setMode] = useState<CompanionMode>("idle");
  const [facing, setFacing] = useState<"left" | "right">("left");
  const [frame, setFrame] = useState(0);

  const positionRef = useRef(position);
  const frameRef = useRef(0);
  const velocityRef = useRef<Point>({ x: 0, y: 0 });
  const modeRef = useRef<CompanionMode>("idle");
  const facingRef = useRef<"left" | "right">("left");
  const pointerOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const pointerSamplesRef = useRef<PointerSample[]>([]);
  const actionUntilRef = useRef(0);
  const nextDecisionAtRef = useRef(0);
  const lastFrameAtRef = useRef(0);
  const lastPersistAtRef = useRef(0);
  const isDraggingRef = useRef(false);
  const reducedMotionRef = useRef(false);

  const updateMode = useCallback((nextMode: CompanionMode) => {
    if (modeRef.current === nextMode) return;
    modeRef.current = nextMode;
    frameRef.current = 0;
    setFrame(0);
    setMode(nextMode);
  }, []);

  const updateFacing = useCallback((nextFacing: "left" | "right") => {
    if (facingRef.current === nextFacing) return;
    facingRef.current = nextFacing;
    setFacing(nextFacing);
  }, []);

  const syncPosition = useCallback((nextPosition: Point) => {
    positionRef.current = nextPosition;
    setPosition(nextPosition);
  }, []);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    const onResize = () => {
      const bounds = getBounds();
      syncPosition({
        x: clamp(positionRef.current.x, WALL_GAP, bounds.maxX),
        y: clamp(positionRef.current.y, FLOOR_GAP, bounds.floorY),
      });
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncPosition]);

  useEffect(() => {
    let rafId = 0;

    const tick = (time: number) => {
      const lastFrameAt = lastFrameAtRef.current || time;
      const dt = Math.min((time - lastFrameAt) / 1000, 0.033);
      lastFrameAtRef.current = time;

      const bounds = getBounds();
      const pos = positionRef.current;
      const vel = velocityRef.current;
      let nextPos = pos;

      if (!isDraggingRef.current) {
        const onFloor = pos.y >= bounds.floorY - 0.5;
        const falling = !onFloor || Math.abs(vel.y) > 1;

        if (falling) {
          vel.y += GRAVITY * dt;
          nextPos = {
            x: pos.x + vel.x * dt,
            y: pos.y + vel.y * dt,
          };

          if (nextPos.x <= WALL_GAP || nextPos.x >= bounds.maxX) {
            nextPos.x = clamp(nextPos.x, WALL_GAP, bounds.maxX);
            vel.x *= -0.32;
          }

          if (nextPos.y >= bounds.floorY) {
            const landingSpeed = vel.y;
            nextPos.y = bounds.floorY;
            vel.y = 0;
            vel.x *= 0.28;

            if (landingSpeed >= HARD_LANDING_SPEED) {
              actionUntilRef.current = time + 1800;
              updateMode("hurt");
            } else {
              nextDecisionAtRef.current = time + 900;
              updateMode("idle");
            }
          } else {
            updateMode("fall");
          }
        } else if (modeRef.current === "hurt") {
          vel.x *= 0.88;
          if (time >= actionUntilRef.current) {
            nextDecisionAtRef.current = time + 900;
            updateMode("idle");
          }
        } else if (reducedMotionRef.current) {
          updateMode("idle");
        } else {
          if (time >= actionUntilRef.current && time >= nextDecisionAtRef.current) {
            const roll = Math.random();

            if (roll < 0.42) {
              actionUntilRef.current = time + 2400 + Math.random() * 2600;
              vel.x = (Math.random() < 0.5 ? -1 : 1) * (72 + Math.random() * 52);
              updateFacing(vel.x < 0 ? "left" : "right");
              updateMode("walk");
            } else if (roll < 0.68) {
              actionUntilRef.current = time + 5200 + Math.random() * 5800;
              vel.x = 0;
              updateMode("sleep");
            } else {
              actionUntilRef.current = time + 1500 + Math.random() * 2200;
              vel.x = 0;
              updateMode("idle");
            }
          }

          if (modeRef.current === "walk") {
            nextPos = {
              x: pos.x + vel.x * dt,
              y: bounds.floorY,
            };

            if (nextPos.x <= WALL_GAP || nextPos.x >= bounds.maxX) {
              vel.x *= -1;
              updateFacing(vel.x < 0 ? "left" : "right");
              nextPos.x = clamp(nextPos.x, WALL_GAP, bounds.maxX);
            }

            if (time >= actionUntilRef.current) {
              vel.x = 0;
              nextDecisionAtRef.current = time + 1000 + Math.random() * 1400;
              updateMode("idle");
            }
          }
        }

        if (nextPos !== pos) {
          syncPosition({
            x: clamp(nextPos.x, WALL_GAP, bounds.maxX),
            y: clamp(nextPos.y, FLOOR_GAP, bounds.floorY),
          });
        }
      }

      const sprite = COMPANION_SPRITES[modeRef.current];
      const nextFrame = reducedMotionRef.current ? 0 : Math.floor(time / sprite.frameMs) % sprite.frames;
      if (frameRef.current !== nextFrame) {
        frameRef.current = nextFrame;
        setFrame(nextFrame);
      }

      if (time - lastPersistAtRef.current > 1200) {
        lastPersistAtRef.current = time;
        try {
          window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(positionRef.current));
        } catch {
          // Non-critical; the companion simply starts from the default next time.
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [syncPosition, updateFacing, updateMode]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();

    const bounds = getBounds();
    const clientPoint = { x: event.clientX, y: event.clientY };
    pointerOffsetRef.current = {
      x: clientPoint.x - positionRef.current.x,
      y: clientPoint.y - positionRef.current.y,
    };
    pointerSamplesRef.current = [{ ...clientPoint, time: event.timeStamp }];
    isDraggingRef.current = true;
    velocityRef.current = { x: 0, y: 0 };
    syncPosition({
      x: clamp(clientPoint.x - pointerOffsetRef.current.x, WALL_GAP, bounds.maxX),
      y: clamp(clientPoint.y - pointerOffsetRef.current.y, FLOOR_GAP, bounds.floorY),
    });
    updateMode("drag");
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingRef.current) return;

    const bounds = getBounds();
    const clientPoint = { x: event.clientX, y: event.clientY };
    const samples = pointerSamplesRef.current;
    samples.push({ ...clientPoint, time: event.timeStamp });
    pointerSamplesRef.current = samples.filter((sample) => event.timeStamp - sample.time <= 120);

    syncPosition({
      x: clamp(clientPoint.x - pointerOffsetRef.current.x, WALL_GAP, bounds.maxX),
      y: clamp(clientPoint.y - pointerOffsetRef.current.y, FLOOR_GAP, bounds.floorY),
    });
  };

  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);

    const samples = pointerSamplesRef.current;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const elapsed = first && last ? Math.max((last.time - first.time) / 1000, 0.016) : 0.016;
    const vx = first && last ? (last.x - first.x) / elapsed : 0;
    const vy = first && last ? (last.y - first.y) / elapsed : 0;
    const releaseSpeed = Math.hypot(vx, vy);
    const bounds = getBounds();

    if (releaseSpeed < THROW_DEAD_ZONE) {
      velocityRef.current = { x: 0, y: 0 };

      if (positionRef.current.y >= bounds.floorY - 1) {
        nextDecisionAtRef.current = event.timeStamp + 900;
        updateMode("idle");
        return;
      }

      updateMode("fall");
      return;
    }

    velocityRef.current = {
      x: clamp(vx * THROW_DAMPING, -440, 440),
      y: clamp(vy * THROW_DAMPING, -620, 620),
    };

    if (Math.abs(velocityRef.current.x) > 20) {
      updateFacing(velocityRef.current.x < 0 ? "left" : "right");
    }
    updateMode("fall");
  };

  const sprite = COMPANION_SPRITES[mode];

  return (
    <button
      type="button"
      className="kloak-companion"
      data-mode={mode}
      data-facing={facing}
      aria-label="Kloak companion"
      title="Kloak companion"
      style={{
        "--companion-x": `${position.x}px`,
        "--companion-y": `${position.y}px`,
        "--companion-width": `${COMPANION_WIDTH}px`,
        "--companion-height": `${COMPANION_HEIGHT}px`,
        "--companion-sprite": `url("${sprite.url}")`,
        "--companion-frames": sprite.frames,
        "--companion-frame-x": `${frame * COMPANION_WIDTH * -1}px`,
        "--companion-foot-drop": `${sprite.footDrop}px`,
      } as CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <span className="kloak-companion__shadow" />
      <span className="kloak-companion__sprite" aria-hidden="true" />
    </button>
  );
}
