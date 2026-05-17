import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-tug-of-war",
  description: "Two teams tap-spam; rope position = the diff. 30s rounds, confetti for winner.",
  accentHex: "#ff8800",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
