"use client";

import { cn } from "@/lib/utils";
import {
  AnimatePresence,
  HTMLMotionProps,
  motion,
  TargetAndTransition,
  Transition,
} from "framer-motion";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";

type SplitType = "words" | "characters" | "lines";
type StaggerFrom = "first" | "last" | "center" | "random" | number;

function splitText(text: string, splitBy: SplitType = "characters"): string[] {
  switch (splitBy) {
    case "words":
      return text.split(/(\s+)/).filter(Boolean);
    case "lines":
      return text.split("\n");
    case "characters":
    default:
      return text.split("");
  }
}

function getStaggerDelay(
  index: number,
  total: number,
  staggerFrom: StaggerFrom,
  staggerDuration: number
): number {
  if (typeof staggerFrom === "number") {
    const distance = Math.abs(index - staggerFrom);
    return distance * staggerDuration;
  }

  switch (staggerFrom) {
    case "first":
      return index * staggerDuration;
    case "last":
      return (total - 1 - index) * staggerDuration;
    case "center": {
      const center = (total - 1) / 2;
      return Math.abs(index - center) * staggerDuration;
    }
    case "random":
      return Math.random() * total * staggerDuration;
    default:
      return index * staggerDuration;
  }
}

export interface TextRotateProps {
  texts: string[];
  rotationInterval?: number;
  auto?: boolean;
  splitBy?: SplitType;
  staggerFrom?: StaggerFrom;
  staggerDuration?: number;
  initial?: TargetAndTransition;
  animate?: TargetAndTransition;
  exit?: TargetAndTransition;
  transition?: Transition;
  mainClassName?: string;
  splitLevelClassName?: string;
  elementLevelClassName?: string;
  onNext?: (index: number) => void;
}

export interface TextRotateRef {
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  getCurrentIndex: () => number;
}

const TextRotate = forwardRef<TextRotateRef, TextRotateProps>(
  (
    {
      texts,
      rotationInterval = 3000,
      auto = true,
      splitBy = "characters",
      staggerFrom = "first",
      staggerDuration = 0.03,
      initial = { y: "100%" },
      animate = { y: 0 },
      exit = { y: "-100%" },
      transition = { type: "spring", damping: 30, stiffness: 400 },
      mainClassName,
      splitLevelClassName,
      elementLevelClassName,
      onNext,
    },
    ref
  ) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const next = useCallback(() => {
      const newIndex = (currentIndex + 1) % texts.length;
      setCurrentIndex(newIndex);
      onNext?.(newIndex);
    }, [currentIndex, texts.length, onNext]);

    const previous = useCallback(() => {
      const newIndex = (currentIndex - 1 + texts.length) % texts.length;
      setCurrentIndex(newIndex);
      onNext?.(newIndex);
    }, [currentIndex, texts.length, onNext]);

    const jumpTo = useCallback(
      (index: number) => {
        const clampedIndex = Math.max(0, Math.min(index, texts.length - 1));
        setCurrentIndex(clampedIndex);
        onNext?.(clampedIndex);
      },
      [texts.length, onNext]
    );

    useImperativeHandle(
      ref,
      () => ({
        next,
        previous,
        jumpTo,
        getCurrentIndex: () => currentIndex,
      }),
      [next, previous, jumpTo, currentIndex]
    );

    useEffect(() => {
      if (!auto) return;
      const interval = setInterval(next, rotationInterval);
      return () => clearInterval(interval);
    }, [auto, rotationInterval, next]);

    const currentText = texts[currentIndex];
    const splitParts = useMemo(
      () => splitText(currentText, splitBy),
      [currentText, splitBy]
    );

    return (
      <div className={cn("relative inline-flex", mainClassName)}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentIndex}
            className={cn("flex flex-wrap", splitLevelClassName)}
          >
            {splitParts.map((part, index) => (
              <motion.span
                key={`${currentIndex}-${index}`}
                initial={initial}
                animate={animate}
                exit={exit}
                transition={{
                  ...transition,
                  delay: getStaggerDelay(
                    index,
                    splitParts.length,
                    staggerFrom,
                    staggerDuration
                  ),
                }}
                className={cn("inline-block", elementLevelClassName)}
              >
                {part === " " ? "\u00A0" : part}
              </motion.span>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }
);

TextRotate.displayName = "TextRotate";

export default TextRotate;
