import { motion } from "framer-motion";

const KLOAK_PATH = "M119.72,31.87V0c-31.55,0-60.26,12.35-81.58,32.46C34.1,22.42,31.87,11.47,31.87,0H0c0,21.92,5.97,42.47,16.35,60.13C6.43,77.49.75,97.58.75,118.98h31.87c0-11.08,2.08-21.68,5.87-31.44,21.2,19.51,49.48,31.44,80.49,31.44v-31.87c-24.86,0-47.31-10.47-63.2-27.22,15.92-17.22,38.69-28.02,63.94-28.02Z";

export default function KloakDrawLoader({ size = 80, color = "#dbd6cb" }: { size?: number; color?: string }) {
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <motion.svg
        width={size} height={size}
        viewBox="0 0 119.72 118.98"
        style={{ position: "absolute", inset: 0 }}
      >
        <motion.path
          d={KLOAK_PATH}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ pathLength: [0, 1, 1, 0] }}
          transition={{
            duration: 2.8,
            times: [0, 0.55, 0.8, 1],
            ease: "easeInOut",
            repeat: Infinity,
            repeatDelay: 0.3,
          }}
        />
      </motion.svg>
      <motion.svg
        width={size} height={size}
        viewBox="0 0 119.72 118.98"
        style={{ position: "absolute", inset: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0] }}
        transition={{
          duration: 2.8,
          times: [0, 0.5, 0.65, 0.8, 1],
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 0.3,
        }}
      >
        <path d={KLOAK_PATH} fill={color} />
      </motion.svg>
    </div>
  );
}
