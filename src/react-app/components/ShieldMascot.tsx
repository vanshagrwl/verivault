import { motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface ShieldMascotProps {
  watchingField: "none" | "email" | "password";
  mouseX: number;
  mouseY: number;
}

export default function ShieldMascot({ watchingField, mouseX, mouseY }: ShieldMascotProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Eye tracking based on mouse position
  const eyeX = useTransform(
    useMotionValue(mouseX),
    [0, window.innerWidth],
    [-8, 8]
  );
  const eyeY = useTransform(
    useMotionValue(mouseY),
    [0, window.innerHeight],
    [-8, 8]
  );

  if (!mounted) return null;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg
        width="400"
        height="400"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="filter drop-shadow-2xl"
      >
        {/* Shield body with gradient */}
        <defs>
          <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="dark:text-cyan-400 text-blue-500" stopColor="currentColor" />
            <stop offset="100%" className="dark:text-purple-500 text-blue-600" stopColor="currentColor" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Main shield shape */}
        <motion.path
          d="M200 50 L320 100 L320 200 Q320 300 200 350 Q80 300 80 200 L80 100 Z"
          fill="url(#shieldGradient)"
          stroke="currentColor"
          strokeWidth="3"
          className="dark:text-cyan-400 text-blue-500"
          filter="url(#glow)"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />

        {/* Shield emblem - checkmark */}
        <motion.path
          d="M160 200 L185 225 L240 160"
          stroke="white"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.5, ease: "easeInOut" }}
        />

        {/* Eyes */}
        <g>
          {/* Left eye */}
          <motion.circle
            cx={160}
            cy={140}
            r={12}
            fill="white"
            animate={
              watchingField === "password"
                ? { opacity: 0 }
                : { opacity: 1 }
            }
            transition={{ duration: 0.2 }}
          />
          <motion.circle
            cx={160 + (watchingField === "email" ? -15 : eyeX.get())}
            cy={140 + (watchingField === "email" ? 10 : eyeY.get())}
            r={6}
            fill="currentColor"
            className="dark:text-gray-900 text-gray-900"
            animate={
              watchingField === "password"
                ? { opacity: 0 }
                : { opacity: 1 }
            }
            transition={{ duration: 0.2 }}
          />

          {/* Right eye */}
          <motion.circle
            cx={240}
            cy={140}
            r={12}
            fill="white"
            animate={
              watchingField === "password"
                ? { opacity: 0 }
                : { opacity: 1 }
            }
            transition={{ duration: 0.2 }}
          />
          <motion.circle
            cx={240 + (watchingField === "email" ? -15 : eyeX.get())}
            cy={140 + (watchingField === "email" ? 10 : eyeY.get())}
            r={6}
            fill="currentColor"
            className="dark:text-gray-900 text-gray-900"
            animate={
              watchingField === "password"
                ? { opacity: 0 }
                : { opacity: 1 }
            }
            transition={{ duration: 0.2 }}
          />
        </g>

        {/* Hands covering eyes when password field is focused */}
        <motion.g
          initial={{ y: 50, opacity: 0 }}
          animate={
            watchingField === "password"
              ? { y: 0, opacity: 1 }
              : { y: 50, opacity: 0 }
          }
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Left hand */}
          <ellipse
            cx={160}
            cy={140}
            rx={25}
            ry={20}
            fill="url(#shieldGradient)"
            opacity={0.9}
          />
          {/* Right hand */}
          <ellipse
            cx={240}
            cy={140}
            rx={25}
            ry={20}
            fill="url(#shieldGradient)"
            opacity={0.9}
          />
        </motion.g>

        {/* Pulse animation ring */}
        <motion.circle
          cx={200}
          cy={200}
          r={150}
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          className="dark:text-cyan-400 text-blue-500"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
}
