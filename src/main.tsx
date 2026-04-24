import { createRoot } from "react-dom/client";
import App from "./app/src/app/App.tsx";
import "./app/src/styles/index.css";

const themeStorageKey = "portfolio-theme";
const savedTheme = window.localStorage.getItem(themeStorageKey);
const initialTheme =
  savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

document.documentElement.classList.toggle("dark", initialTheme === "dark");
document.documentElement.style.colorScheme = initialTheme;

createRoot(document.getElementById("root")!).render(<App />);
  
