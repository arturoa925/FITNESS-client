// Alert.alert records the call and "presses" the button chosen by the test.
exports.Platform = { OS: "ios" };
exports.Alert = {
  alert: (title, message, buttons) => {
    (globalThis.__alerts = globalThis.__alerts || []).push({ title, message, buttons });
    const pick = globalThis.__alertPick; // e.g. "Not now" or "Enable"
    const btn = (buttons || []).find((b) => pick && b.text.includes(pick));
    if (btn && btn.onPress) btn.onPress();
  },
};
