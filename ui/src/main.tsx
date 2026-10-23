import { createRoot } from "react-dom/client";
import { BrowserApp } from "./BrowserApp";
import "./style.css";

const element = document.getElementById("root");
if (!element) throw new Error("The application root is missing.");
createRoot(element).render(<BrowserApp />);
