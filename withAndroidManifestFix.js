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

    // Register the notification listener services — required for
    // react-native-android-notification-listener to receive notifications.
    // These are NOT added automatically by that package's own config,
    // since it predates Expo's config-plugin system.
    if (!application.service) {
      application.service = [];
    }

    const alreadyHasListener = application.service.some(
      (s) =>
        s.$["android:name"] ===
        "com.leandrosimoes.reactnativeandroidnotificationlistener.RNAndroidNotificationListenerService",
    );

    if (!alreadyHasListener) {
      application.service.push(
        {
          $: {
            "android:name":
              "com.leandrosimoes.reactnativeandroidnotificationlistener.RNAndroidNotificationListenerService",
            "android:label": "Dhebu Notification Listener",
            "android:permission":
              "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
            "android:exported": "false",
          },
          "intent-filter": [
            {
              action: [
                {
                  $: {
                    "android:name":
                      "android.service.notification.NotificationListenerService",
                  },
                },
              ],
            },
          ],
        },
        {
          $: {
            "android:name":
              "com.leandrosimoes.reactnativeandroidnotificationlistener.RNAndroidNotificationListenerHeadlessJsTaskService",
            "android:exported": "false",
          },
        },
      );
    }

    return config;
  });
};
