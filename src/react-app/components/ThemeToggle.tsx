import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-500 p-1 shadow-lg hover:shadow-xl transition-shadow"
      aria-label="Toggle theme"
    >
      <motion.div
        className="w-full h-full rounded-full bg-card flex items-center justify-center"
        animate={{ rotate: theme === "dark" ? 0 : 180 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        {theme === "dark" ? (
          <Moon className="w-6 h-6 text-primary" />
        ) : (
          <Sun className="w-6 h-6 text-primary" />
        )}
      </motion.div>
    </button>
  );
}
