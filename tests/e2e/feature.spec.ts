import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

// The in-app countdown is 3s; wait past it (plus mesh-sync slack) before the
// TAP button is enabled and the phase is "pull".
const PULL_WAIT = 3600;

test("right-team taps shift the rope toward right on both peers", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByLabel("your name").fill("alice");
    await b.getByLabel("your name").fill("bob");
    await a.waitForTimeout(500);

    await a.getByRole("button", { name: "join Left", exact: true }).click();
    await b.getByRole("button", { name: "join Right", exact: true }).click();
    await a.waitForTimeout(300);

    await a.getByRole("button", { name: "Start", exact: true }).click();
    await a.waitForTimeout(PULL_WAIT);

    for (let i = 0; i < 5; i++) {
      await b.getByRole("button", { name: "TAP", exact: true }).click();
    }
    await a.waitForTimeout(500);

    // A (the other peer) must see B's 5 right-team taps.
    await expect(a.locator(".tow-right-total")).toContainText("5");
    const pct = await a.locator(".tow-rope").getAttribute("data-rope-pct");
    if (Number(pct) <= 50) throw new Error("rope should favor right, got " + pct);
  } finally {
    await cleanup();
  }
});

/**
 * Load-bearing convergence test. The rope is a *derived* value computed on each
 * peer from EVERY peer's own per-peer tap count partitioned by team. This drives
 * BOTH peers (A pulls Left, B pulls Right) and asserts that A's screen and B's
 * screen agree on the same per-team totals AND the same rope offset. A
 * peer-local-only counter (each screen only seeing its own taps) would fail
 * this: A would never see B's right pulls and the two rope positions would
 * disagree.
 */
test("both teams' taps converge to one shared rope offset on both screens", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByLabel("your name").fill("alice");
    await b.getByLabel("your name").fill("bob");
    await a.waitForTimeout(500);

    await a.getByRole("button", { name: "join Left", exact: true }).click();
    await b.getByRole("button", { name: "join Right", exact: true }).click();
    await a.waitForTimeout(300);

    await a.getByRole("button", { name: "Start", exact: true }).click();
    await a.waitForTimeout(PULL_WAIT);

    // A pulls 7 for LEFT, B pulls 3 for RIGHT — opposite directions on a shared rope.
    for (let i = 0; i < 7; i++) {
      await a.getByRole("button", { name: "TAP", exact: true }).click();
    }
    for (let i = 0; i < 3; i++) {
      await b.getByRole("button", { name: "TAP", exact: true }).click();
    }
    await a.waitForTimeout(700);

    // Both screens must see BOTH teams' totals — not just their own.
    await expect(a.locator(".tow-left-total")).toContainText("7");
    await expect(a.locator(".tow-right-total")).toContainText("3");
    await expect(b.locator(".tow-left-total")).toContainText("7");
    await expect(b.locator(".tow-right-total")).toContainText("3");

    // position = (right - left) * K = (3 - 7) * 2 = -8.
    // pct = ((-8 + 50) / 100) * 100 = 42, identical on both peers.
    const pctA = await a.locator(".tow-rope").getAttribute("data-rope-pct");
    const pctB = await b.locator(".tow-rope").getAttribute("data-rope-pct");
    expect(pctA).toBe("42");
    expect(pctB).toBe(pctA);
  } finally {
    await cleanup();
  }
});
