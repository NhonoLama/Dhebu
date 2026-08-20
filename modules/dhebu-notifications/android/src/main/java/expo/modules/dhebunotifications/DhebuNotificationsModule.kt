package expo.modules.dhebunotifications

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.os.Build
import android.provider.Settings
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.util.UUID

class DhebuNotificationsModule : Module() {

  companion object {

    /*
     * =====================================================
     * SHARED PREFERENCES
     * =====================================================
     */

    private const val PREFS_NAME =
      "dhebu_notification_settings"

    private const val KEY_ALLOWED_PACKAGES =
      "allowed_packages"

    private const val KEY_NOTIFICATION_QUEUE =
      "notification_queue"

    /*
     * Stores:
     *
     * fingerprint -> timestamp
     *
     * Example:
     *
     * {
     *   "a71f8..." : 1787220054170,
     *   "9bd21..." : 1787220054990
     * }
     */
    private const val KEY_RECENT_FINGERPRINTS =
      "recent_notification_fingerprints"

    /*
     * Same dedupe window as JavaScript.
     *
     * 1500 ms = 1.5 seconds.
     */
    private const val DEDUPE_WINDOW_MS =
      1500L

    /*
     * We don't need old fingerprints forever.
     *
     * Anything older than 30 seconds gets removed
     * during cleanup.
     */
    private const val FINGERPRINT_RETENTION_MS =
      30_000L

    /*
     * Prevent the native queue from growing forever
     * if JS cannot process notifications for a long time.
     */
    private const val MAX_QUEUE_SIZE =
      200

    private const val BRIDGE_TAG =
      "DHEBU_BRIDGE"

    private const val DEDUPE_TAG =
      "DHEBU_DEDUPE"

    private var currentInstance:
      DhebuNotificationsModule? = null

    /*
     * Shared lock because NotificationListenerService
     * and Expo module can access SharedPreferences
     * concurrently.
     */
    private val queueLock =
      Any()

    /*
     * =====================================================
     * ENQUEUE RESULT
     * =====================================================
     *
     * We need to tell the Android service whether:
     *
     * 1. this was a new notification
     * 2. this was a duplicate
     *
     * If duplicate = true, the service must NOT emit
     * another event to JS.
     */
    data class EnqueueResult(
      val queueId: String?,
      val duplicate: Boolean
    )

    /*
     * =====================================================
     * NORMALIZE CONTENT
     * =====================================================
     *
     * JS currently does:
     *
     * trim()
     * lowercase()
     *
     * We do approximately the same here so both layers
     * agree on what counts as the same logical message.
     */
    private fun normalizeFingerprintValue(
      value: String
    ): String {

      return value
        .trim()
        .lowercase()
    }

    /*
     * =====================================================
     * BUILD CONTENT FINGERPRINT
     * =====================================================
     *
     * IMPORTANT:
     *
     * We deliberately DO NOT use notificationKey.
     *
     * Android / Gmail / Messages may generate different
     * notification keys for the same visible notification.
     *
     * Logical fingerprint:
     *
     * package
     * title
     * text
     * bigText
     * subText
     */
    private fun buildNotificationFingerprint(
      app: String,
      title: String,
      text: String,
      bigText: String,
      subText: String
    ): String {

      val rawFingerprint =
        listOf(
          normalizeFingerprintValue(app),
          normalizeFingerprintValue(title),
          normalizeFingerprintValue(text),
          normalizeFingerprintValue(bigText),
          normalizeFingerprintValue(subText)
        )
          .joinToString("|")

      /*
       * SHA-256 keeps the stored fingerprint small
       * even when notification text is very long.
       */
      val digest =
        MessageDigest
          .getInstance("SHA-256")
          .digest(
            rawFingerprint
              .toByteArray(
                Charsets.UTF_8
              )
          )

      return digest.joinToString("") {
        "%02x".format(it)
      }
    }

    /*
     * =====================================================
     * CHECK + RECORD FINGERPRINT
     * =====================================================
     *
     * Returns:
     *
     * true  = duplicate
     * false = new notification
     */
    private fun isDuplicateAndRecordFingerprint(
      context: Context,
      fingerprint: String,
      now: Long
    ): Boolean {

      val prefs =
        context.getSharedPreferences(
          PREFS_NAME,
          Context.MODE_PRIVATE
        )

      val savedJson =
        prefs.getString(
          KEY_RECENT_FINGERPRINTS,
          null
        )

      val fingerprints =
        try {

          if (
            savedJson.isNullOrBlank()
          ) {
            JSONObject()
          } else {
            JSONObject(
              savedJson
            )
          }

        } catch (
          error: Exception
        ) {

          Log.e(
            DEDUPE_TAG,
            "Fingerprint store corrupted. Resetting.",
            error
          )

          JSONObject()
        }

      /*
       * =================================================
       * CLEAN OLD FINGERPRINTS
       * =================================================
       */

      val keys =
        fingerprints.keys()

      val keysToRemove =
        mutableListOf<String>()

      while (
        keys.hasNext()
      ) {

        val key =
          keys.next()

        val timestamp =
          fingerprints.optLong(
            key,
            0L
          )

        if (
          timestamp <= 0L ||
          now - timestamp >
          FINGERPRINT_RETENTION_MS
        ) {

          keysToRemove.add(
            key
          )
        }
      }

      for (
        key in keysToRemove
      ) {

        fingerprints.remove(
          key
        )
      }

      /*
       * =================================================
       * DUPLICATE CHECK
       * =================================================
       */

      val previousTime =
        fingerprints.optLong(
          fingerprint,
          0L
        )

      if (
        previousTime > 0L &&
        now - previousTime <
        DEDUPE_WINDOW_MS
      ) {

        /*
         * Save cleanup changes if there were any.
         */
        prefs
          .edit()
          .putString(
            KEY_RECENT_FINGERPRINTS,
            fingerprints.toString()
          )
          .apply()

        Log.d(
          DEDUPE_TAG,
          "Duplicate notification rejected natively"
        )

        return true
      }

      /*
       * New logical notification.
       *
       * Remember it.
       */
      fingerprints.put(
        fingerprint,
        now
      )

      prefs
        .edit()
        .putString(
          KEY_RECENT_FINGERPRINTS,
          fingerprints.toString()
        )
        .apply()

      Log.d(
        DEDUPE_TAG,
        "New notification fingerprint recorded"
      )

      return false
    }

    /*
     * =====================================================
     * PERSISTENT NOTIFICATION QUEUE
     * =====================================================
     */

    fun enqueueNotification(
      context: Context,
      app: String,
      appLabel: String,
      title: String,
      text: String,
      bigText: String,
      subText: String,
      postedAt: Long,
      notificationKey: String
    ): EnqueueResult {

      synchronized(
        queueLock
      ) {

        /*
         * ===============================================
         * NATIVE DEDUPE HAPPENS BEFORE QUEUE WRITE
         * ===============================================
         */

        val fingerprint =
          buildNotificationFingerprint(
            app = app,
            title = title,
            text = text,
            bigText = bigText,
            subText = subText
          )

        val now =
          System.currentTimeMillis()

        val duplicate =
          isDuplicateAndRecordFingerprint(
            context = context,
            fingerprint = fingerprint,
            now = now
          )

        if (
          duplicate
        ) {

          /*
           * Nothing is added to the persistent queue.
           */
          return EnqueueResult(
            queueId = null,
            duplicate = true
          )
        }

        /*
         * ===============================================
         * NEW NOTIFICATION
         * ===============================================
         */

        val queueId =
          UUID
            .randomUUID()
            .toString()

        val prefs =
          context.getSharedPreferences(
            PREFS_NAME,
            Context.MODE_PRIVATE
          )

        val existingJson =
          prefs.getString(
            KEY_NOTIFICATION_QUEUE,
            null
          )

        val existingArray =
          try {

            if (
              existingJson.isNullOrBlank()
            ) {
              JSONArray()
            } else {
              JSONArray(
                existingJson
              )
            }

          } catch (
            error: Exception
          ) {

            Log.e(
              BRIDGE_TAG,
              "Native queue was corrupted. Resetting it.",
              error
            )

            JSONArray()
          }

        /*
         * Keep only the newest items if the queue
         * reaches MAX_QUEUE_SIZE.
         */
        val newArray =
          JSONArray()

        val startIndex =
          maxOf(
            0,
            existingArray.length() -
              (
                MAX_QUEUE_SIZE -
                  1
              )
          )

        for (
          index in startIndex
          until existingArray.length()
        ) {

          newArray.put(
            existingArray.get(
              index
            )
          )
        }

        val item =
          JSONObject().apply {

            put(
              "queueId",
              queueId
            )

            /*
             * Store fingerprint too.
             *
             * Useful later for debugging or stronger
             * database-level idempotency.
             */
            put(
              "fingerprint",
              fingerprint
            )

            put(
              "app",
              app
            )

            put(
              "appLabel",
              appLabel
            )

            put(
              "title",
              title
            )

            put(
              "text",
              text
            )

            put(
              "bigText",
              bigText
            )

            put(
              "subText",
              subText
            )

            put(
              "postedAt",
              postedAt
            )

            put(
              "notificationKey",
              notificationKey
            )

            put(
              "queuedAt",
              now
            )
          }

        newArray.put(
          item
        )

        /*
         * commit() is intentional.
         *
         * We want the native notification safely
         * persisted BEFORE attempting JS delivery.
         */
        val saved =
          prefs
            .edit()
            .putString(
              KEY_NOTIFICATION_QUEUE,
              newArray.toString()
            )
            .commit()

        if (
          !saved
        ) {

          Log.e(
            BRIDGE_TAG,
            "Failed to persist native notification queue"
          )

        } else {

          Log.d(
            BRIDGE_TAG,
            "Notification queued natively: $queueId | $app"
          )
        }

        return EnqueueResult(
          queueId = queueId,
          duplicate = false
        )
      }
    }

    /*
     * =====================================================
     * READ QUEUED NOTIFICATIONS
     * =====================================================
     */

    private fun getQueuedNotifications(
      context: Context
    ): List<Map<String, Any>> {

      synchronized(
        queueLock
      ) {

        val prefs =
          context.getSharedPreferences(
            PREFS_NAME,
            Context.MODE_PRIVATE
          )

        val json =
          prefs.getString(
            KEY_NOTIFICATION_QUEUE,
            null
          )

        if (
          json.isNullOrBlank()
        ) {

          return emptyList()
        }

        return try {

          val array =
            JSONArray(
              json
            )

          val result =
            mutableListOf<
              Map<String, Any>
              >()

          for (
            index in 0
            until array.length()
          ) {

            val item =
              array.getJSONObject(
                index
              )

            result.add(
              mapOf(
                "queueId" to
                  item.optString(
                    "queueId"
                  ),

                "app" to
                  item.optString(
                    "app"
                  ),

                "appLabel" to
                  item.optString(
                    "appLabel"
                  ),

                "title" to
                  item.optString(
                    "title"
                  ),

                "text" to
                  item.optString(
                    "text"
                  ),

                "bigText" to
                  item.optString(
                    "bigText"
                  ),

                "subText" to
                  item.optString(
                    "subText"
                  ),

                "postedAt" to
                  item.optLong(
                    "postedAt"
                  ),

                "notificationKey" to
                  item.optString(
                    "notificationKey"
                  ),

                "queuedAt" to
                  item.optLong(
                    "queuedAt"
                  )
              )
            )
          }

          result

        } catch (
          error: Exception
        ) {

          Log.e(
            BRIDGE_TAG,
            "Failed reading native notification queue",
            error
          )

          emptyList()
        }
      }
    }

    /*
     * =====================================================
     * REMOVE ACKNOWLEDGED QUEUE ITEM
     * =====================================================
     */

    private fun removeQueuedNotification(
      context: Context,
      queueId: String
    ): Boolean {

      synchronized(
        queueLock
      ) {

        val prefs =
          context.getSharedPreferences(
            PREFS_NAME,
            Context.MODE_PRIVATE
          )

        val json =
          prefs.getString(
            KEY_NOTIFICATION_QUEUE,
            null
          )

        if (
          json.isNullOrBlank()
        ) {
          return true
        }

        return try {

          val oldArray =
            JSONArray(
              json
            )

          val newArray =
            JSONArray()

          for (
            index in 0
            until oldArray.length()
          ) {

            val item =
              oldArray.getJSONObject(
                index
              )

            if (
              item.optString(
                "queueId"
              ) != queueId
            ) {

              newArray.put(
                item
              )
            }
          }

          val saved =
            prefs
              .edit()
              .putString(
                KEY_NOTIFICATION_QUEUE,
                newArray.toString()
              )
              .commit()

          if (
            saved
          ) {

            Log.d(
              BRIDGE_TAG,
              "Removed notification from native queue: $queueId"
            )
          }

          saved

        } catch (
          error: Exception
        ) {

          Log.e(
            BRIDGE_TAG,
            "Failed removing notification from native queue",
            error
          )

          false
        }
      }
    }

    /*
     * =====================================================
     * JS EVENT BRIDGE
     * =====================================================
     */

    fun emitNotification(
      queueId: String,
      app: String,
      appLabel: String,
      title: String,
      text: String,
      bigText: String,
      subText: String,
      postedAt: Long,
      notificationKey: String
    ): Boolean {

      val instance =
        currentInstance

      if (
        instance == null
      ) {

        /*
         * Not data loss anymore.
         *
         * Notification already exists in native queue.
         */
        Log.d(
          BRIDGE_TAG,
          "JS unavailable. Notification remains queued: $queueId"
        )

        return false
      }

      Log.d(
        BRIDGE_TAG,
        "Sending queued notification to JavaScript: $queueId | $app"
      )

      instance.sendEvent(
        "onNotificationReceived",
        mapOf(
          "queueId" to
            queueId,

          "app" to
            app,

          "appLabel" to
            appLabel,

          "title" to
            title,

          "text" to
            text,

          "bigText" to
            bigText,

          "subText" to
            subText,

          "postedAt" to
            postedAt,

          "notificationKey" to
            notificationKey
        )
      )

      return true
    }
  }

  /*
   * =======================================================
   * EXPO MODULE DEFINITION
   * =======================================================
   */

  override fun definition() =
    ModuleDefinition {

      Name(
        "DhebuNotifications"
      )

      Events(
        "onNotificationReceived"
      )

      OnCreate {

        currentInstance =
          this@DhebuNotificationsModule

        Log.d(
          BRIDGE_TAG,
          "DhebuNotificationsModule CREATED"
        )
      }

      OnDestroy {

        Log.d(
          BRIDGE_TAG,
          "DhebuNotificationsModule DESTROYED"
        )

        if (
          currentInstance ===
          this@DhebuNotificationsModule
        ) {

          currentInstance =
            null
        }
      }

      /*
       * ===================================================
       * NOTIFICATION ACCESS
       * ===================================================
       */

      AsyncFunction(
        "isNotificationAccessGrantedAsync"
      ) {

        val context =
          appContext.reactContext
            ?: throw IllegalStateException(
              "React context is unavailable"
            )

        val componentName =
          ComponentName(
            "com.anonymous.Dhebu",
            "com.anonymous.Dhebu.notifications.DhebuNotificationListenerService"
          )

        if (
          Build.VERSION.SDK_INT >=
          Build.VERSION_CODES.O_MR1
        ) {

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
            componentName
              .flattenToShortString()
          )
        }
      }

      AsyncFunction(
        "openNotificationAccessSettingsAsync"
      ) {

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

        context.startActivity(
          intent
        )

        true
      }

      /*
       * ===================================================
       * INSTALLED APPS
       * ===================================================
       */

      AsyncFunction(
        "getInstalledAppsAsync"
      ) {

        val context =
          appContext.reactContext
            ?: throw IllegalStateException(
              "React context is unavailable"
            )

        val packageManager =
          context.packageManager

        val intent =
          Intent(
            Intent.ACTION_MAIN
          ).apply {

            addCategory(
              Intent.CATEGORY_LAUNCHER
            )
          }

        val resolvedApps:
          List<ResolveInfo> =

          if (
            Build.VERSION.SDK_INT >=
            Build.VERSION_CODES.TIRAMISU
          ) {

            packageManager
              .queryIntentActivities(
                intent,
                PackageManager
                  .ResolveInfoFlags
                  .of(0)
              )

          } else {

            @Suppress(
              "DEPRECATION"
            )

            packageManager
              .queryIntentActivities(
                intent,
                0
              )
          }

        resolvedApps
          .mapNotNull {
              resolveInfo ->

            val activityInfo =
              resolveInfo
                .activityInfo
                ?: return@mapNotNull null

            val packageName =
              activityInfo
                .packageName
                ?: return@mapNotNull null

            if (
              packageName ==
              context.packageName
            ) {

              return@mapNotNull null
            }

            val appLabel =
              try {

                resolveInfo
                  .loadLabel(
                    packageManager
                  )
                  .toString()

              } catch (
                _: Exception
              ) {

                packageName
              }

            mapOf(
              "packageName" to
                packageName,

              "appLabel" to
                appLabel
            )
          }
          .distinctBy {

            it[
              "packageName"
            ]
          }
          .sortedBy {

            it[
              "appLabel"
            ]
              ?.lowercase()
              ?: ""
          }
      }

      /*
       * ===================================================
       * ALLOWED APPS
       * ===================================================
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
          )
            ?: emptySet()

        packages.toList()
      }

      AsyncFunction(
        "setAllowedNotificationAppsAsync"
      ) {
          packages:
          List<String> ->

        val context =
          appContext.reactContext
            ?: throw IllegalStateException(
              "React context is unavailable"
            )

        val cleanedPackages =
          packages
            .map {
              it.trim()
            }
            .filter {
              it.isNotEmpty()
            }
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
          BRIDGE_TAG,
          "Allowed notification apps updated: $cleanedPackages"
        )

        true
      }

      /*
       * ===================================================
       * PERSISTENT QUEUE API
       * ===================================================
       */

      AsyncFunction(
        "getQueuedNotificationsAsync"
      ) {

        val context =
          appContext.reactContext
            ?: throw IllegalStateException(
              "React context is unavailable"
            )

        getQueuedNotifications(
          context
        )
      }

      AsyncFunction(
        "removeQueuedNotificationAsync"
      ) {
          queueId:
          String ->

        val context =
          appContext.reactContext
            ?: throw IllegalStateException(
              "React context is unavailable"
            )

        removeQueuedNotification(
          context,
          queueId
        )
      }
    }
}