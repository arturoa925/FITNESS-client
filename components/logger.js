// client/utils/logger.js
// Pretty console logs for Metro / RN terminal
const RESET = "\x1b[0m";
const GRAY = "\x1b[90m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

export const section = (title = "") => {
  const line = "=".repeat(Math.max(10, Math.min(60, title.length + 10)));
  console.log(`\n${CYAN}${line}\n• ${title}\n${line}${RESET}`);
};

export const json = (label = "", data) => {
  try {
    const pretty =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);
    console.log(`${GRAY}${label}:${RESET}\n${pretty}`);
  } catch {
    console.log(`${GRAY}${label}:${RESET} <unserializable>`, data);
  }
};

export const info = (label = "", ...rest) =>
  console.log(`${CYAN}${label}${RESET}`, ...rest);
export const success = (label = "", ...rest) =>
  console.log(`${GREEN}${label}${RESET}`, ...rest);
export const warn = (label = "", ...rest) =>
  console.warn(`${YELLOW}${label}${RESET}`, ...rest);
export const error = (label = "", ...rest) =>
  console.error(`${RED}${label}${RESET}`, ...rest);