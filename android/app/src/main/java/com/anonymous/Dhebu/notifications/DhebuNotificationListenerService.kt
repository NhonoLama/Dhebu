package com.anonymous.Dhebu.notifications
import com.anonymous.Dhebu.BuildConfig

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import expo.modules.dhebunotifications.DhebuNotificationsModule

class DhebuNotificationListenerService :
  NotificationListenerService() {

  companion object {
    private const val TAG =
      "DHEBU_NOTIFICATION"

    private const val PREFS_NAME =
      "dhebu_notification_settings"

    private const val KEY_ALLOWED_PACKAGES =
      "allowed_packages"
  }

  override fun onCreate() {
    super.onCreate()

    if (BuildConfig.DEBUG) {
      Log.d(
        TAG,
        "DhebuNotificationListenerService created"
      )
    }
  }

  override fun onListenerConnected() {
    super.onListenerConnected()

    if (BuildConfig.DEBUG) {
      Log.d(
        TAG,
        "Notification listener CONNECTED"
      )
    }
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()

    Log.w(
        TAG,
        "Notification listener DISCONNECTED - requesting rebind"
    )

    try {
        requestRebind(
            android.content.ComponentName(
                this,
                DhebuNotificationListenerService::class.java
            )
        )
        if (BuildConfig.DEBUG) {
        Log.d(
          TAG,
          "Notification listener rebind requested"
        )
      }

    } catch (error: Exception) {

        Log.e(
            TAG,
            "Failed requesting notification listener rebind",
            error
        )
    }
}

  override fun onNotificationPosted(
    sbn: StatusBarNotification?
  ) {
    if (sbn == null) {
      return
    }

    try {
      val packageName =
        sbn.packageName ?: return

      /*
       * IMPORTANT:
       *
       * Stop immediately if the user did not
       * explicitly select this app.
       *
       * No title extraction.
       * No app-label lookup.
       * No JS bridge.
       * No SQLite query.
       * No parser.
       */
      if (!isAllowedPackage(packageName)) {
        if (BuildConfig.DEBUG) {
          Log.d(
            TAG,
            "IGNORED package: $packageName"
          )
        }

        return
      }

      if (BuildConfig.DEBUG) {
        Log.d(
          TAG,
          "ALLOWED package: $packageName"
        )
      }

      val notification =
        sbn.notification

      val extras =
        notification.extras

      val appLabel =
        getApplicationLabel(
          packageName
        )

      val title =
        extras
          ?.getCharSequence(
            Notification.EXTRA_TITLE
          )
          ?.toString()
          ?: ""

      val text =
        extras
          ?.getCharSequence(
            Notification.EXTRA_TEXT
          )
          ?.toString()
          ?: ""

      val bigText =
        extras
          ?.getCharSequence(
            Notification.EXTRA_BIG_TEXT
          )
          ?.toString()
          ?: ""

      val subText =
        extras
          ?.getCharSequence(
            Notification.EXTRA_SUB_TEXT
          )
          ?.toString()
          ?: ""

      if (BuildConfig.DEBUG) {
        Log.d(
          TAG,
          """
          -----------------------------
          ALLOWED NOTIFICATION
          PACKAGE: $packageName
          APP_LABEL: $appLabel
          TITLE: $title
          TEXT: $text
          BIG_TEXT: $bigText
          SUB_TEXT: $subText
          POST_TIME: ${sbn.postTime}
          KEY: ${sbn.key}
          -----------------------------
          """.trimIndent()
        )
      }

      val enqueueResult =
  DhebuNotificationsModule.enqueueNotification(
    context = applicationContext,
    app = packageName,
    appLabel = appLabel,
    title = title,
    text = text,
    bigText = bigText,
    subText = subText,
    postedAt = sbn.postTime,
    notificationKey = sbn.key
  )

/*
 * Native dedupe rejected this callback.
 *
 * Do not queue it.
 * Do not send it to JS.
 */
if (enqueueResult.duplicate) {

  if (BuildConfig.DEBUG) {
  Log.d(
    TAG,
    "DUPLICATE package ignored natively: $packageName"
  )
}

  return
}

val queueId =
  enqueueResult.queueId
    ?: return

DhebuNotificationsModule.emitNotification(
  queueId = queueId,
  app = packageName,
  appLabel = appLabel,
  title = title,
  text = text,
  bigText = bigText,
  subText = subText,
  postedAt = sbn.postTime,
  notificationKey = sbn.key
)

    } catch (error: Exception) {
      Log.e(
        TAG,
        "Failed to process notification",
        error
      )
    }
  }

  override fun onNotificationRemoved(
    sbn: StatusBarNotification?
  ) {
    if (sbn == null) {
      return
    }

    /*
     * We don't need to do anything when
     * notifications are removed.
     */
  }

  private fun isAllowedPackage(
    packageName: String
  ): Boolean {

    val prefs =
      getSharedPreferences(
        PREFS_NAME,
        Context.MODE_PRIVATE
      )

    val allowedPackages =
      prefs.getStringSet(
        KEY_ALLOWED_PACKAGES,
        emptySet()
      ) ?: emptySet()

    return allowedPackages.contains(
      packageName
    )
  }

  private fun getApplicationLabel(
    packageName: String
  ): String {

    if (packageName.isBlank()) {
      return ""
    }

    return try {
      val applicationInfo =
        packageManager
          .getApplicationInfo(
            packageName,
            0
          )

      packageManager
        .getApplicationLabel(
          applicationInfo
        )
        .toString()

    } catch (error: Exception) {

      Log.w(
        TAG,
        "Could not resolve app label for $packageName"
      )

      packageName
    }
  }
}