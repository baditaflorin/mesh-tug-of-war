import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-tug-of-war",
  description: "Two teams tap frantically — the rope moves live on every phone",
  accentHex: "#e8643c",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
