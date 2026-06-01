import { describe, expect, it } from "vitest";
import { ropePosition, winnerOf, teamTotals, ropePercent, type Team } from "../../src/logic";

describe("ropePosition", () => {
  it("is zero when both teams tap equally", () => {
    expect(ropePosition(10, 10, 2, 50)).toBe(0);
  });

  it("goes positive (toward RIGHT) when the right team taps harder", () => {
    expect(ropePosition(3, 7, 2, 50)).toBe(8); // (7-3)*2
  });

  it("goes negative (toward LEFT) when the left team taps harder", () => {
    expect(ropePosition(9, 4, 2, 50)).toBe(-10); // (4-9)*2
  });

  it("clamps a right-side blowout to +max", () => {
    expect(ropePosition(0, 1000, 2, 50)).toBe(50);
  });

  it("clamps a left-side blowout to -max", () => {
    expect(ropePosition(1000, 0, 2, 50)).toBe(-50);
  });
});

describe("winnerOf", () => {
  it("returns null mid-rope (no winner yet)", () => {
    expect(winnerOf(0, 50)).toBeNull();
    expect(winnerOf(20, 50)).toBeNull();
    expect(winnerOf(-49, 50)).toBeNull();
  });

  it("crowns RIGHT at the positive threshold", () => {
    expect(winnerOf(50, 50)).toBe("R");
    expect(winnerOf(60, 50)).toBe("R");
  });

  it("crowns LEFT at the negative threshold", () => {
    expect(winnerOf(-50, 50)).toBe("L");
    expect(winnerOf(-80, 50)).toBe("L");
  });

  it("never declares a winner when max is non-positive", () => {
    expect(winnerOf(100, 0)).toBeNull();
  });
});

describe("teamTotals", () => {
  const teamOf = (id: string): Team => (id.startsWith("L") ? "L" : id.startsWith("R") ? "R" : "");

  it("sums each peer's taps into the right team bucket", () => {
    const entries: Array<[string, number]> = [
      ["L-alice", 4],
      ["L-bob", 3],
      ["R-carol", 5],
    ];
    expect(teamTotals(entries, teamOf)).toEqual({ left: 7, right: 5 });
  });

  it("ignores unassigned spectators and junk values", () => {
    const entries: Array<[string, number]> = [
      ["spectator", 99],
      ["R-dave", 6],
      ["L-eve", Number.NaN],
      ["L-frank", -3],
    ];
    expect(teamTotals(entries, teamOf)).toEqual({ left: 0, right: 6 });
  });

  it("returns zeros for an empty roster", () => {
    expect(teamTotals([], teamOf)).toEqual({ left: 0, right: 0 });
  });
});

describe("ropePercent", () => {
  it("maps the extremes and centre to 0/50/100", () => {
    expect(ropePercent(-50, 50)).toBe(0);
    expect(ropePercent(0, 50)).toBe(50);
    expect(ropePercent(50, 50)).toBe(100);
  });

  it("clamps out-of-range positions before mapping", () => {
    expect(ropePercent(999, 50)).toBe(100);
    expect(ropePercent(-999, 50)).toBe(0);
  });
});
