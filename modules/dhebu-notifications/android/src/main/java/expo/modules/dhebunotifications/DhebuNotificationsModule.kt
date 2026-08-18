package expo.modules.dhebunotifications

import android.content.pm.ResolveInfo
import android.content.pm.PackageManager

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DhebuNotificationsModule : Module() {

  companion object {
    private const val PREFS_NAME = "dhebu_notification_settings"
    private const val KEY_ALLOWED_PACKAGES = "allowed_packages"

    private var currentInstance: DhebuNotificationsModule? = null

    fun emitNotification(
      app: String,
      appLabel: String,
      title: String,
      text: String,
      bigText: String,
      subText: String,
      postedAt: Long,
      notificationKey: String
    ) {
      val instance = currentInstance

      if (instance == null) {
        Log.e(
          "DHEBU_BRIDGE",
          "Cannot emit notification: DhebuNotificationsModule instance is NULL"
        )
        return
      }

      Log.d(
        "DHEBU_BRIDGE",
        "Sending notification event to JavaScript: $app | $title"
      )

      instance.sendEvent(
        "onNotificationReceived",
        mapOf(
          "app" to app,
          "appLabel" to appLabel,
          "title" to title,
          "text" to text,
          "bigText" to bigText,
          "subText" to subText,
          "postedAt" to postedAt,
          "notificationKey" to notificationKey
        )
      )
    }
  }

  override fun definition() = ModuleDefinition {
    Name("DhebuNotifications")

    Events("onNotificationReceived")

    OnCreate {
      currentInstance = this@DhebuNotificationsModule

      Log.d(
        "DHEBU_BRIDGE",
        "DhebuNotificationsModule CREATED"
      )
    }

    OnDestroy {
      Log.d(
        "DHEBU_BRIDGE",
        "DhebuNotificationsModule DESTROYED"
      )

      if (currentInstance === this@DhebuNotificationsModule) {
        currentInstance = null
      }
    }

    AsyncFunction("isNotificationAccessGrantedAsync") {
      val context =
        appContext.reactContext
          ?: throw IllegalStateException(
            "React context is unavailable"
          )

      val componentName = ComponentName(
        "com.anonymous.Dhebu",
        "com.anonymous.Dhebu.notifications.DhebuNotificationListenerService"
      )

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        val notificationManager =
          context.getSystemService(
            Context.NOTIFICATION_SERVICE
          ) as NotificationManager

        notificationManager
          .isNotificationListenerAccessGranted(
            componentName
          )
      } else {
        val enabledListeners =
          Settings.Secure.getString(
            context.contentResolver,
            "enabled_notification_listeners"
          ) ?: ""

        enabledListeners.contains(
          componentName.flattenToShortString()
        )
      }
    }

    AsyncFunction("getInstalledAppsAsync") {
  val context =
    appContext.reactContext
      ?: throw IllegalStateException(
        "React context is unavailable"
      )

  val packageManager =
    context.packageManager

  val intent =
    Intent(Intent.ACTION_MAIN).apply {
      addCategory(Intent.CATEGORY_LAUNCHER)
    }

  val resolvedApps: List<ResolveInfo> =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      packageManager.queryIntentActivities(
        intent,
        PackageManager.ResolveInfoFlags.of(0)
      )
    } else {
      @Suppress("DEPRECATION")
      packageManager.queryIntentActivities(
        intent,
        0
      )
    }

  resolvedApps
    .mapNotNull { resolveInfo ->

      val activityInfo =
        resolveInfo.activityInfo
          ?: return@mapNotNull null

      val packageName =
        activityInfo.packageName
          ?: return@mapNotNull null

      /*
       * Don't show Dhebu itself as a selectable
       * notification source.
       */
      if (packageName == context.packageName) {
        return@mapNotNull null
      }

      val appLabel =
        try {
          resolveInfo.loadLabel(
            packageManager
          ).toString()
        } catch (_: Exception) {
          packageName
        }

      mapOf(
        "packageName" to packageName,
        "appLabel" to appLabel
      )
    }
    .distinctBy {
      it["packageName"]
    }
    .sortedBy {
      it["appLabel"]
        ?.lowercase()
        ?: ""
    }
}

    AsyncFunction("openNotificationAccessSettingsAsync") {
      val context =
        appContext.reactContext
          ?: throw IllegalStateException(
            "React context is unavailable"
          )

      val intent =
        Intent(
          Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS
        ).apply {
          addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
          )
        }

      context.startActivity(intent)

      true
    }

    /*
     * Returns the package names Dhebu is currently
     * allowed to process.
     */
    AsyncFunction(
      "getAllowedNotificationAppsAsync"
    ) {
      val context =
        appContext.reactContext
          ?: throw IllegalStateException(
            "React context is unavailable"
          )

      val prefs =
        context.getSharedPreferences(
          PREFS_NAME,
          Context.MODE_PRIVATE
        )

      val packages =
        prefs.getStringSet(
          KEY_ALLOWED_PACKAGES,
          emptySet()
        ) ?: emptySet()

      packages.toList()
    }

    /*
     * Replaces the complete allowed-app list.
     *
     * Example:
     *
     * [
     *   "com.google.android.apps.messaging"
     * ]
     */
    AsyncFunction(
      "setAllowedNotificationAppsAsync"
    ) { packages: List<String> ->

      val context =
        appContext.reactContext
          ?: throw IllegalStateException(
            "React context is unavailable"
          )

      val cleanedPackages =
        packages
          .map { it.trim() }
          .filter { it.isNotEmpty() }
          .toSet()

      val prefs =
        context.getSharedPreferences(
          PREFS_NAME,
          Context.MODE_PRIVATE
        )

      prefs
        .edit()
        .putStringSet(
          KEY_ALLOWED_PACKAGES,
          cleanedPackages
        )
        .apply()

      Log.d(
        "DHEBU_BRIDGE",
        "Allowed notification apps updated: $cleanedPackages"
      )

      true
    }
  }
}