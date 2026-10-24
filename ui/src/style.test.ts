import { afterEach, beforeEach, expect, test } from "vitest";
import css from "./style.css?raw";

let style: HTMLStyleElement;
beforeEach(() => {
  style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
});
afterEach(() => {
  style.remove();
  document.body.replaceChildren();
});

test("draft errors keep the same alert color as PDF errors", () => {
  document.body.innerHTML = `
    <section class="document-toolbar"><p role="alert">Draft save failed.</p></section>
    <section class="preview-panel"><p role="alert">PDF export failed.</p></section>`;
  const alerts = document.querySelectorAll("[role=alert]");
  expect(getComputedStyle(alerts[0]).color).toBe(
    getComputedStyle(alerts[1]).color,
  );
});

test("native controls use the light UI color scheme", () => {
  expect(getComputedStyle(document.documentElement).colorScheme).toBe("light");
});

test("document titles wrap rather than clip or truncate", () => {
  const title = document.createElement("p");
  title.className = "document-title";
  title.textContent = "X".repeat(512);
  document.body.append(title);
  expect(getComputedStyle(title).overflowWrap).toBe("anywhere");
  expect(getComputedStyle(title).whiteSpace).toBe("normal");
});
