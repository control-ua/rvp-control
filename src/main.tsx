import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import Portal from "./portal/Portal";
const cabinet = new URLSearchParams(window.location.search).get("cabinet");
const isPortal =
  cabinet === "customer" ||
  cabinet === "contractor" ||
  !!window.Telegram?.WebApp?.initData;
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isPortal ? <Portal /> : <App />}</StrictMode>,
);
