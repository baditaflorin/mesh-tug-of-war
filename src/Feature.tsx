import { useEffect, useRef, useState } from "react";
import {
  ConfettiLayer,
  useConfetti,
  useNamedPeer,
  usePerPeerValue,
  useRoster,
  useVibration,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";
import { ropePercent, ropePosition, teamTotals, winnerOf, type Team } from "./logic";

type Props = { room: YRoom | null; config: MeshConfig };
type Phase = "lobby" | "countdown" | "pull" | "result";

// Rope tuning. K is taps→offset gain; MAX is the win threshold (and the
// half-width of the track). Both peers MUST agree on these so the derived
// position is identical everywhere — they live in code, never in the mesh.
const K = 2;
const MAX = 50;
// 3-2-1 countdown length before "PULL!".
const COUNTDOWN_MS = 3000;

const GAME_KEY = "tug:game";

/** Shared game pointer: the match id, the current phase, the PULL start time, and the winner. */
function useGame(room: YRoom) {
  const [, rerender] = useState(0);
  useEffect(() => {
    const m = room.doc.getMap(GAME_KEY);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room]);

  const m = room.doc.getMap(GAME_KEY);
  const matchId = (m.get("matchId") as number | undefined) ?? 0;
  const phase = (m.get("phase") as Phase | undefined) ?? "lobby";
  const startAt = (m.get("startAt") as number | undefined) ?? 0;
  const winner = (m.get("winner") as Team | undefined) ?? "";

  /** Anyone can kick off a fresh match: bump the id, arm the countdown. */
  const startMatch = () => {
    room.doc.transact(() => {
      m.set("matchId", matchId + 1);
      m.set("phase", "countdown");
      m.set("startAt", Date.now() + COUNTDOWN_MS);
      m.set("winner", "");
    });
  };

  /** Countdown elapsed → live tug. Guarded so only the first writer wins on merge. */
  const beginPull = () => {
    if ((m.get("phase") as Phase | undefined) !== "countdown") return;
    m.set("phase", "pull");
  };

  /** First peer to see the marker cross a threshold records the winner. */
  const declareWinner = (w: Team) => {
    if ((m.get("phase") as Phase | undefined) !== "pull") return;
    room.doc.transact(() => {
      m.set("phase", "result");
      m.set("winner", w);
    });
  };

  // Rematch is just a fresh start: bumping matchId resets every peer's taps.
  return { matchId, phase, startAt, winner, startMatch, beginPull, declareWinner };
}

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="tow-screen">
        <h1 className="tow-title">🪢 {config.appName}</h1>
        <p className="tow-status">Connecting to the room…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, nameOf, myName } = useNamedPeer(config, room);
  const roster = useRoster(room);
  const game = useGame(room);
  const team = usePerPeerValue<Team>(room, "tug:team", "");
  const taps = usePerPeerValue<number>(room, `tug:taps:${game.matchId}`, 0);
  const { burst } = useConfetti();
  const vib = useVibration();

  // Tick once a second during the countdown so 3→2→1 updates locally.
  const [, tick] = useState(0);
  useEffect(() => {
    if (game.phase !== "countdown") return;
    const id = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [game.phase]);

  // teamOf for the pure totals helper, backed by the shared per-peer team map.
  const teamOf = (peerId: string): Team => (team.all[peerId] as Team | undefined) ?? "";
  const { left, right } = teamTotals(taps.entries, teamOf);
  const position = ropePosition(left, right, K, MAX);
  const pct = ropePercent(position, MAX);

  // Countdown → pull: the first peer past startAt flips the shared phase.
  useEffect(() => {
    if (game.phase !== "countdown") return;
    const remaining = game.startAt - Date.now();
    if (remaining <= 0) {
      game.beginPull();
      return;
    }
    const id = setTimeout(() => game.beginPull(), remaining);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase, game.startAt, game.matchId]);

  // Win detection: derive from the shared position, first observer records it.
  useEffect(() => {
    if (game.phase !== "pull") return;
    const w = winnerOf(position, MAX);
    if (w) game.declareWinner(w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase, position]);

  // Confetti once when a result lands, themed to the winning side.
  const celebratedRef = useRef(-1);
  useEffect(() => {
    if (game.phase !== "result" || !game.winner) return;
    if (celebratedRef.current === game.matchId) return;
    celebratedRef.current = game.matchId;
    const hueRange: [number, number] = game.winner === "R" ? [205, 235] : [0, 20];
    burst({ origin: "center", count: 120, hueRange, ttlMs: 2400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase, game.winner, game.matchId]);

  const myTeam = team.my;
  const trimmed = name.trim();

  const present = roster.present.length ? roster.present : [room.peerId];
  const nameFor = (id: string) =>
    nameOf(id) ?? (id === room.peerId ? myName : `peer-${id.slice(0, 4)}`);
  const leftRoster = present.filter((id) => teamOf(id) === "L");
  const rightRoster = present.filter((id) => teamOf(id) === "R");

  const pickTeam = (t: Team) => {
    if (game.phase === "pull" || game.phase === "countdown") return;
    team.setMy(t);
  };

  /** Send me to whichever team currently has fewer present players. */
  const autoBalance = () => {
    if (game.phase === "pull" || game.phase === "countdown") return;
    team.setMy(leftRoster.length <= rightRoster.length ? "L" : "R");
  };

  const tap = () => {
    if (game.phase !== "pull" || (myTeam !== "L" && myTeam !== "R")) return;
    taps.setMy((taps.my ?? 0) + 1);
    vib.vibrate(20);
  };

  const countdownNum = Math.max(1, Math.ceil((game.startAt - Date.now()) / 1000));
  const canStart = game.phase === "lobby" || game.phase === "result";
  const winnerLabel =
    game.winner === "R"
      ? "🔵 Right team WINS!"
      : game.winner === "L"
        ? "🔴 Left team WINS!"
        : "Draw!";

  return (
    <div className="tow-screen" data-phase={game.phase}>
      <ConfettiLayer />

      <header className="tow-header">
        <h1 className="tow-title">🪢 tug-of-war</h1>
        <p className="tow-status">
          {present.length} phone{present.length === 1 ? "" : "s"} · {game.phase}
          {game.matchId > 0 ? ` · match ${game.matchId}` : ""}
        </p>
      </header>

      {!trimmed && (
        <label className="tow-name">
          Your name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            maxLength={24}
            aria-label="your name"
          />
        </label>
      )}

      {/* ---- Team pickers + live rosters ---- */}
      <div className="tow-teams" role="group" aria-label="pick a team">
        <div className="tow-team-col" data-team="L">
          <button
            type="button"
            className={`tow-team tow-team-left ${myTeam === "L" ? "is-mine" : ""}`}
            data-team="L"
            onClick={() => pickTeam("L")}
            disabled={!trimmed || game.phase === "countdown" || game.phase === "pull"}
            aria-label="join Left"
          >
            🔴 Left
          </button>
          <span className="tow-team-total tow-left-total" data-team="L">
            {left}
          </span>
          <ul className="tow-roster">
            {leftRoster.map((id) => (
              <li key={id} className={id === room.peerId ? "is-me" : ""}>
                {nameFor(id)}
              </li>
            ))}
          </ul>
        </div>

        <div className="tow-team-col" data-team="R">
          <button
            type="button"
            className={`tow-team tow-team-right ${myTeam === "R" ? "is-mine" : ""}`}
            data-team="R"
            onClick={() => pickTeam("R")}
            disabled={!trimmed || game.phase === "countdown" || game.phase === "pull"}
            aria-label="join Right"
          >
            🔵 Right
          </button>
          <span className="tow-team-total tow-right-total" data-team="R">
            {right}
          </span>
          <ul className="tow-roster">
            {rightRoster.map((id) => (
              <li key={id} className={id === room.peerId ? "is-me" : ""}>
                {nameFor(id)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {canStart && (
        <button
          type="button"
          className="tow-switch"
          onClick={autoBalance}
          disabled={!trimmed}
          aria-label="auto-balance team"
        >
          ⚖︎ {myTeam ? "Switch / balance team" : "Auto-pick a team"}
        </button>
      )}

      {/* ---- The rope / track with a live centre flag ---- */}
      <div
        className={`tow-rope ${game.phase === "pull" ? "is-live" : ""}`}
        data-rope-pct={Math.round(pct)}
        data-position={position}
        aria-label="rope position"
      >
        <span className="tow-rope-zone tow-rope-zone-left" aria-hidden="true" />
        <span className="tow-rope-center" aria-hidden="true" />
        <span className="tow-rope-zone tow-rope-zone-right" aria-hidden="true" />
        <span
          className="tow-rope-flag"
          style={{ left: `${pct}%` }}
          data-team={position < 0 ? "L" : position > 0 ? "R" : ""}
          aria-hidden="true"
        >
          🚩
        </span>
      </div>

      {/* ---- Phase-specific main area ---- */}
      {game.phase === "countdown" && (
        <div className="tow-countdown" aria-label="countdown">
          <span className="tow-countdown-num">{countdownNum}</span>
          <span className="tow-countdown-hint">get ready…</span>
        </div>
      )}

      {game.phase === "pull" && (
        <button
          type="button"
          className="tow-tap"
          onClick={tap}
          disabled={myTeam !== "L" && myTeam !== "R"}
          aria-label="TAP"
        >
          {myTeam ? "TAP! TAP! TAP!" : "pick a team to pull"}
        </button>
      )}

      {game.phase === "result" && (
        <div className="tow-result">
          <h2 className="tow-winner">{winnerLabel}</h2>
          <p className="tow-final">
            🔴 {left} &nbsp;·&nbsp; {right} 🔵
          </p>
        </div>
      )}

      {/* ---- Start / rematch ---- */}
      {canStart && (
        <button
          type="button"
          className="tow-start"
          onClick={game.startMatch}
          disabled={!trimmed}
          aria-label={game.phase === "result" ? "Rematch" : "Start"}
        >
          {game.phase === "result" ? "↻ Rematch" : "▶ Start"}
        </button>
      )}
    </div>
  );
}
