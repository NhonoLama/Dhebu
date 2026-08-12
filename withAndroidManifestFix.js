const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withAndroidManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application[0];

    application.$["tools:replace"] = application.$["tools:replace"]
      ? `${application.$["tools:replace"]},android:allowBackup`
      : "android:allowBackup";

    const permissions = manifest.manifest["uses-permission"] || [];
    permissions.forEach((perm) => {
      const name = perm.$["android:name"];
      if (
        name === "android.permission.READ_EXTERNAL_STORAGE" ||
        name === "android.permission.WRITE_EXTERNAL_STORAGE"
      ) {
        perm.$["android:maxSdkVersion"] = "32";
        perm.$["tools:replace"] = "android:maxSdkVersion";
      }
    });

    return config;
  });
};
