import { createRoot } from "react-dom/client";
import App from "./app/src/app/App.tsx";
import { resolveInitialTheme } from "./app/src/app/lib/theme-bootstrap";
import "./app/src/styles/index.css";

const initialTheme = resolveInitialTheme();

document.documentElement.classList.toggle("dark", initialTheme === "dark");
document.documentElement.style.colorScheme = initialTheme;

createRoot(document.getElementById("root")!).render(<App />);
  
