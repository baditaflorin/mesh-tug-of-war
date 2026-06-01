# mesh-tug-of-war

[![pages](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh-tug-of-war-ff8800)](https://baditaflorin.github.io/mesh-tug-of-war/)
[![version](https://img.shields.io/badge/version-0.1.1-blue)](https://github.com/baditaflorin/mesh-tug-of-war/blob/main/package.json)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

> Two teams tap frantically — the rope moves live on every phone

**Live → https://baditaflorin.github.io/mesh-tug-of-war/**

**Source → https://github.com/baditaflorin/mesh-tug-of-war**

**Tip the dev (buy a coffee) → https://www.paypal.com/paypalme/florinbadita**

---

![screenshot](docs/screenshot.png)

> Two peers, side-by-side, in the same room. Drop a `tests/demo/scenario.mjs`
> exporting `default async (a, b) => …` and run `npm run demo` to regenerate
> `docs/preview.png` plus `docs/demo-a.webm` / `docs/demo-b.webm` clips.

![preview](docs/preview.png)

## What it is

A **rootless-computing** peer-to-peer browser app. No backend of its own beyond the self-hosted WebRTC stack listed below. State lives in a Yjs mesh shared by everyone in the same room.

Read the principles → **https://baditaflorin.github.io/rootless-computing/principles.html**

## How to play

A co-located party game — no app store, no accounts. One person opens the link;
everyone else scans the room QR (⚙ → invite) or opens the same URL on their own
phone. You're all in one room.

1. **Pick a side.** Tap **🔴 Left** or **🔵 Right** — your name drops into that
   team's roster on every phone. Hit **⚖︎ Switch / balance** to jump to the
   smaller team if the sides are lopsided.
2. **Start.** Anyone taps **▶ Start**. A shared **3 · 2 · 1** countdown runs on
   every screen at once, then flips to **PULL!**
3. **Tap like mad.** During the pull, every tap on _your_ phone adds force to
   _your_ team. The flag 🚩 on the shared rope slides toward whichever side is
   tapping harder — live, on every phone, because the position is derived from
   each player's own tap count (no contended shared counter).
4. **Win.** First team to drag the flag all the way to their end wins. Confetti
   fires in the winning side's colour, the final tap totals show, and **↻
   Rematch** starts a fresh match (everyone's taps reset to zero).

Each phone publishes only its _own_ cumulative tap count to the mesh; every
phone then sums those by team and clamps `(right − left) × K` into the rope
position, so all screens agree on where the flag sits no matter what order the
CRDT updates arrive in.

## Quickstart

Open the live URL on two devices in the same room (set in ⚙ settings, or scan the room QR). Everything else is in-app.

For local hacking:

```bash
git clone https://github.com/baditaflorin/mesh-common
git clone https://github.com/baditaflorin/mesh-tug-of-war
cd mesh-tug-of-war
npm install
npm run dev
```

`mesh-common` must sit as a **sibling** directory because `package.json` references it via `file:../mesh-common`.

## Self-hosted infrastructure

| Repo                                              | Endpoint                               | Purpose                     |
| ------------------------------------------------- | -------------------------------------- | --------------------------- |
| https://github.com/baditaflorin/signaling-server  | `wss://turn.0docker.com/ws`            | y-webrtc signaling fan-out  |
| https://github.com/baditaflorin/turn-token-server | `https://turn.0docker.com/credentials` | HMAC TURN creds, 1-hour TTL |
| https://github.com/baditaflorin/coturn-hetzner    | `turn:turn.0docker.com:3479`           | TURN relay                  |

## Settings overrides

The settings drawer lets the user override signaling and TURN endpoints. localStorage keys:

- `mesh-tug-of-war:signalingUrl`
- `mesh-tug-of-war:turnTokenUrl`
- `mesh-tug-of-war:iceServers`
- `mesh-tug-of-war:room`

If endpoints are blank or unreachable, the app falls back to STUN-only.

## Version + commit on every screen

The bottom-right footer on every screen of the live app shows:

- `source` → this repo
- `tip ♥` → PayPal
- `vX.Y.Z · <short-sha>` — version from `package.json` plus the build-time git commit

## Build & deploy

GitHub Pages serves the committed `docs/` directory on the `main` branch. There is no GitHub Actions build workflow; local Husky-style hooks gate formatting / typecheck / smoke build before each push.

```bash
npm run smoke                                    # build + sanity-check docs/
bash ../mesh-common/scripts/screenshot-app.sh    # regenerate docs/screenshot.png
```

## Privacy

See `docs/privacy.md` for the threat model — what other peers in the mesh see, what the self-hosted infra sees, what stays local.

## License

MIT — see `LICENSE`.
