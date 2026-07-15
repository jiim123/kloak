const base = require("./app.json").expo;

const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || base.extra?.eas?.projectId;

module.exports = {
  expo: {
    ...base,
    extra: {
      ...(base.extra || {}),
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
