import { createRoot } from "react-dom/client";
import CafeChaos from "./cafe-chaos.jsx";

createRoot(document.getElementById("root")).render(<CafeChaos />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
