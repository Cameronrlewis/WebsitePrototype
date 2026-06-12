import { MotionConfig } from "motion/react";

import { Layout } from "./components/Layout";
import { ThemeProvider } from "./components/ThemeProvider";

export default function App() {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <Layout />
      </MotionConfig>
    </ThemeProvider>
  );
}
