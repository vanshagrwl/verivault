import { motion } from "framer-motion";

export default function SkeletonCard() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="backdrop-blur-xl bg-card/40 border border-border/50 rounded-xl p-4"
    >
      <div className="space-y-4">
        {/* Name skeleton */}
        <motion.div
          className="h-6 bg-muted rounded-md w-3/4"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />

        {/* Course skeleton */}
        <motion.div
          className="h-4 bg-muted rounded-md w-1/2"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.1 }}
        />

        {/* Status badge skeleton */}
        <motion.div
          className="h-6 bg-muted rounded-full w-24"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
        />

        {/* Date skeleton */}
        <motion.div
          className="h-4 bg-muted rounded-md w-32"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
        />

        {/* ID skeleton */}
        <motion.div
          className="h-3 bg-muted rounded-md w-full mt-4"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
        />

        {/* Actions skeleton */}
        <div className="pt-4 border-t border-border flex items-center gap-2">
          <motion.div
            className="h-9 bg-muted rounded-md flex-1"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
          />
          <motion.div
            className="h-9 w-9 bg-muted rounded-md"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
          />
          <motion.div
            className="h-9 w-9 bg-muted rounded-md"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.7 }}
          />
        </div>
      </div>
    </motion.div>
  );
}
