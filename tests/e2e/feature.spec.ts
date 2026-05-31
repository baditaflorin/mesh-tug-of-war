import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("red taps shift rope toward red on both peers", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);
    await a.getByRole("button", { name: "join RED", exact: true }).click();
    await b.getByRole("button", { name: "join BLUE", exact: true }).click();
    await a.getByRole("button", { name: "start round", exact: true }).click();
    await a.waitForTimeout(300);
    for (let i = 0; i < 5; i++) {
      await a.getByRole("button", { name: "TAP", exact: true }).click();
    }
    await b.waitForTimeout(400);
    await expect(b.locator(".tow-red-total")).toContainText("5");
    const pct = await b.locator(".tow-rope").getAttribute("data-rope-pct");
    if (Number(pct) <= 50) throw new Error("rope should favor red, got " + pct);
  } finally {
    await cleanup();
  }
});

/**
 * Load-bearing convergence test. The rope is a *shared tally* — both peers'
 * taps move the same knot in opposite directions. This drives BOTH peers
 * (A pulls for RED, B pulls for BLUE) and asserts that A's screen and B's
 * screen agree on the same red/blue totals AND the same rope offset. A
 * per-peer-local counter (each screen only seeing its own taps) would fail
 * this: A would never see B's BLUE pulls and the two rope positions would
 * disagree.
 */
test("both teams' taps converge to one shared rope offset on both screens", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);
    await a.getByRole("button", { name: "join RED", exact: true }).click();
    await b.getByRole("button", { name: "join BLUE", exact: true }).click();
    await a.waitForTimeout(300);
    await a.getByRole("button", { name: "start round", exact: true }).click();
    await a.waitForTimeout(400);

    // A pulls 7 for RED, B pulls 3 for BLUE — opposite directions on a shared rope.
    for (let i = 0; i < 7; i++) {
      await a.getByRole("button", { name: "TAP", exact: true }).click();
    }
    for (let i = 0; i < 3; i++) {
      await b.getByRole("button", { name: "TAP", exact: true }).click();
    }
    await a.waitForTimeout(600);

    // Both screens must see BOTH teams' totals — not just their own.
    await expect(a.locator(".tow-red-total")).toContainText("7");
    await expect(a.locator(".tow-blue-total")).toContainText("3");
    await expect(b.locator(".tow-red-total")).toContainText("7");
    await expect(b.locator(".tow-blue-total")).toContainText("3");

    // diff = 7 - 3 = +4 → ropePct = 50 + clamp(4*2) = 58, identical on both peers.
    const pctA = await a.locator(".tow-rope").getAttribute("data-rope-pct");
    const pctB = await b.locator(".tow-rope").getAttribute("data-rope-pct");
    expect(pctA).toBe("58");
    expect(pctB).toBe(pctA);
  } finally {
    await cleanup();
  }
});
