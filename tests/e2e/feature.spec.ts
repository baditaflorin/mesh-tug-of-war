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
