const base = require("./app.json").expo;
const fs = require("fs");
const path = require("path");

function readDotenv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return {};

  return fs.readFileSync(envPath, "utf8").split(/\r?\n/).reduce((env, rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return env;

    const index = line.indexOf("=");
    if (index === -1) return env;

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
    return env;
  }, {});
}

const dotenv = readDotenv();
const env = (name) => process.env[name] || dotenv[name] || "";

const easProjectId = env("EXPO_PUBLIC_EAS_PROJECT_ID") || base.extra?.eas?.projectId;

module.exports = {
  expo: {
    ...base,
    extra: {
      ...(base.extra || {}),
      mobile: {
        ...(base.extra?.mobile || {}),
        webUrl: env("EXPO_PUBLIC_KLOAK_WEB_URL") || "https://kloak.app/app",
        supabaseUrl: env("EXPO_PUBLIC_SUPABASE_URL"),
        supabasePublishableKey: env("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      },
      ...(easProjectId
        ? {
            eas: {
              ...(base.extra?.eas || {}),
              projectId: easProjectId,
            },
          }
        : {}),
    },
  },
};
