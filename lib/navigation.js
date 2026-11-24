import { createNavigationContainerRef } from "@react-navigation/native";

// Lets code outside React components (e.g. the 401 handler) navigate.
export const navigationRef = createNavigationContainerRef();

export function resetToWelcome(params = {}) {
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: "Welcome", params }] });
  }
}
