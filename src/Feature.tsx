import { useEffect, useMemo, useRef, useState } from "react";
import {
  ConfettiLayer,
  Leaderboard,
  useConfetti,
  useDeadline,
  useFlashOnChange,
  useNamedPeer,
  usePerPeerValue,
  usePhase,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };
type Team = "red" | "blue" | null;
type Tap = { count: number; ts: number };

const ROUND_MS = 30_000;

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="tow-screen">
        <h1>tug of war</h1>
        <p className="tow-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, nameOf } = useNamedPeer(config, room);
  const teams = usePerPeerValue<Team>(room, "teams", null);
  const taps = usePerPeerValue<Tap>(room, "taps", { count: 0, ts: 0 });
  const phase = usePhase<"lobby" | "round" | "done">(room, "phase", "lobby");
  const roundMap = useMemo(() => room.doc.getMap<number>("round"), [room]);
  const [, rerenderRound] = useState(0);
  useEffect(() => {
    const cb = () => rerenderRound((n) => n + 1);
    roundMap.observe(cb);
    return () => roundMap.unobserve(cb);
  }, [roundMap]);

  const start = roundMap.get("start") ?? 0;
  const roundN = roundMap.get("n") ?? 0;
  const deadline = useDeadline(start ? start + ROUND_MS : null);
  const { burst } = useConfetti();
  const teamOf = (peerId: string): Team => teams.valueOf(peerId) ?? null;

  let red = 0;
  let blue = 0;
  for (const [peerId, tk] of taps.entries) {
    const t = teamOf(peerId);
    if (t === "red") red += tk.count;
    else if (t === "blue") blue += tk.count;
  }
  const diff = red - blue;
  const ropePct = 50 + Math.max(-50, Math.min(50, diff * 2));
  const flashing = useFlashOnChange(Math.round(ropePct));

  const endedRef = useRef(0);
  useEffect(() => {
    if (phase.phase !== "round" || !start || !deadline.isPast) return;
    if (endedRef.current === roundN) return;
    endedRef.current = roundN;
    if (phase.transition("done", { from: "round" })) {
      const winnerHue: [number, number] = red >= blue ? [0, 30] : [200, 240];
      burst({ origin: "center", count: 120, hueRange: winnerHue, ttlMs: 2400 });
    }
  }, [phase, deadline.isPast, start, roundN, red, blue, burst]);

  const joinTeam = (t: "red" | "blue") => {
    if (phase.phase === "round") return;
    teams.setMy(t);
  };

  const startRound = () => {
    if (phase.phase === "round") return;
    room.doc.transact(() => {
      const m = room.doc.getMap<Tap>("taps");
      m.forEach((_v, k) => m.set(k, { count: 0, ts: 0 }));
      roundMap.set("start", Date.now());
      roundMap.set("n", roundN + 1);
    });
    phase.transition("round", { from: ["lobby", "done"] });
  };

  const tap = () => {
    if (phase.phase !== "round" || !teams.my) return;
    taps.setMy({ count: (taps.my?.count ?? 0) + 1, ts: Date.now() });
  };

  const trimmed = name.trim();
  const present = room.peerCount + 1;
  const items = taps.entries
    .map(([id, tk]) => ({
      id,
      name: nameOf(id) ?? `peer-${id.slice(0, 6)}`,
      score: tk.count,
      sub: teamOf(id) ?? "—",
      isMe: id === room.peerId,
    }))
    .sort((a, b) => b.score - a.score);

  const winner = phase.phase === "done" ? (red > blue ? "RED" : blue > red ? "BLUE" : "TIE") : null;
  const tickPct = deadline.remainingMs > 0 ? (deadline.remainingMs / ROUND_MS) * 100 : 0;

  return (
    <div className="tow-screen">
      <ConfettiLayer />
      <header className="tow-header">
        <h1>tug of war</h1>
        <p className="tow-status">
          round {roundN} · {present} peer{present === 1 ? "" : "s"} · {phase.phase}
        </p>
      </header>

      <input
        className="tow-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="your name"
        maxLength={48}
        aria-label="your name"
      />

      <div className="tow-teams" role="group" aria-label="pick team">
        {(["red", "blue"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`tow-team ${teams.my === t ? "is-mine" : ""}`}
            data-team={t}
            onClick={() => joinTeam(t)}
            disabled={!trimmed || phase.phase === "round"}
            aria-label={`join ${t.toUpperCase()}`}
          >
            join {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div
        className={`tow-rope ${flashing ? "is-flash" : ""}`}
        data-rope-pct={ropePct}
        style={{ opacity: 0.55 + Math.min(0.45, Math.abs(diff) / 40) }}
      >
        <span className="tow-rope-axis" aria-hidden="true" />
        <span className="tow-rope-knot" style={{ left: `${ropePct}%` }} aria-hidden="true" />
      </div>

      <div className="tow-totals">
        <span className="tow-red-total" data-team="red">
          {red}
        </span>
        <span className="tow-vs">vs</span>
        <span className="tow-blue-total" data-team="blue">
          {blue}
        </span>
      </div>

      <button
        type="button"
        className="tow-tap"
        onClick={tap}
        disabled={phase.phase !== "round" || !teams.my}
        aria-label="TAP"
      >
        TAP
      </button>

      {phase.phase !== "round" && (
        <button
          type="button"
          className="tow-start"
          onClick={startRound}
          disabled={!trimmed}
          aria-label="start round"
        >
          start round
        </button>
      )}

      {phase.phase === "round" && (
        <div className="tow-countdown" aria-label="time remaining">
          <span className="tow-countdown-bar" style={{ width: `${tickPct}%` }} />
          <span className="tow-countdown-label">{deadline.fmt}</span>
        </div>
      )}

      {winner && <p className="tow-winner">{winner === "TIE" ? "tie!" : `${winner} wins!`}</p>}

      <Leaderboard items={items} highlightId={room.peerId} title="taps" />
    </div>
  );
}
