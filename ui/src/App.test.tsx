import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "./App";

afterEach(cleanup);

test("connection failures are visible and have a retry action", () => {
  const retry = vi.fn();
  render(
    <App state="error" message="The connection failed." onRetry={retry} />,
  );
  expect(screen.getByRole("alert").textContent).toBe("The connection failed.");
  fireEvent.click(screen.getByRole("button", { name: "Check connection" }));
  expect(retry).toHaveBeenCalledOnce();
});

test("the application has workspace navigation instead of a development-status card", () => {
  render(
    <App state="ready" message="The server is ready." onRetry={vi.fn()} />,
  );
  expect(
    screen.getByRole("heading", { level: 1, name: "Cheat Sheet Generator" }),
  ).toBeDefined();
  expect(screen.getByRole("navigation", { name: "Workspace" })).toBeDefined();
  expect(
    screen.getByRole("link", { name: "PDF preview" }).getAttribute("href"),
  ).toBe("#pdf-heading");
  expect(screen.queryByRole("heading", { name: "Rewrite status" })).toBeNull();
});

test("the page distinguishes available source editing from disabled compilation", () => {
  render(
    <App state="ready" message="The server is ready." onRetry={vi.fn()} />,
  );
  expect(
    screen.getByText(/Structured and raw source editing are available/),
  ).toBeDefined();
  expect(screen.getByText(/PDF compilation is disabled/)).toBeDefined();
});
