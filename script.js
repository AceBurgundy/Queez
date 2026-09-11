import { Root } from "./Component.js";
import { App } from "./components/pages/app/templates/app.js";
import { initializeTheme } from "./common/scripts/theme-manager.js";
import { initializeViewportScaling } from "./common/scripts/viewport-scaler.js";
import documentationData from "./data/data.js";

initializeTheme();
initializeViewportScaling();

export const AppRoot = class extends App {
  constructor() {
    super({ documentationData });
  }
};

new Root({
  destination: AppRoot,
  path: "/",
  useHash: true,
  persistent: true
}).render();
