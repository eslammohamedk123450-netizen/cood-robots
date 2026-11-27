package com.solina.assistant

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.content.Intent
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private val appUrl = "https://eslammohamedk123450-netizen.github.io/cood-robots/"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.addJavascriptInterface(SolinaBridge(this), "SolinaNative")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host == "eslammohamedk123450-netizen.github.io") return false
                return true
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val allowed = request.resources.filter { it == PermissionRequest.RESOURCE_AUDIO_CAPTURE }
                    if (allowed.isNotEmpty() && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(allowed.toTypedArray())
                    } else request.deny()
                }
            }
        }
        setContentView(webView)
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 2101)
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 2102)
        }
        webView.loadUrl(appUrl)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    class SolinaBridge(private val activity: Activity) {
        @JavascriptInterface fun scheduleTask(raw: String): String = try {
            val task = JSONObject(raw)
            val id = task.optString("id").ifBlank { java.util.UUID.randomUUID().toString() }
            val type = task.optString("type")
            val title = task.optString("title").take(120)
            val at = task.optLong("at")
            if (type !in listOf("alarm", "reminder") || title.isBlank() || at <= System.currentTimeMillis()) {
                JSONObject().put("ok", false).put("error", "invalid_task").toString()
            } else if (Build.VERSION.SDK_INT >= 31 && !(activity.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()) {
                JSONObject().put("ok", false).put("error", "exact_alarm_permission_required").toString()
            } else if (Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                JSONObject().put("ok", false).put("error", "notification_permission_required").toString()
            } else {
                val saved = JSONObject().put("id", id).put("type", type).put("title", title).put("at", at)
                TaskStore.upsert(activity, saved)
                AlarmScheduler.schedule(activity, saved)
                JSONObject().put("ok", true).put("task", saved).toString()
            }
        } catch (error: Exception) {
            JSONObject().put("ok", false).put("error", error.message ?: "schedule_failed").toString()
        }

        @JavascriptInterface fun listTasks(): String = TaskStore.all(activity).toString()

        @JavascriptInterface fun cancelTask(id: String): String = try {
            AlarmScheduler.cancel(activity, id)
            TaskStore.remove(activity, id)
            JSONObject().put("ok", true).toString()
        } catch (error: Exception) {
            JSONObject().put("ok", false).put("error", error.message ?: "cancel_failed").toString()
        }

        @JavascriptInterface fun requestNotificationPermission() {
            activity.runOnUiThread {
                if (Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 2102)
                }
            }
        }

        @JavascriptInterface fun requestExactAlarmPermission() {
            activity.runOnUiThread {
                if (Build.VERSION.SDK_INT >= 31) {
                    val manager = activity.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                    if (!manager.canScheduleExactAlarms()) {
                        val intent = Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                        intent.data = Uri.parse("package:" + activity.packageName)
                        activity.startActivity(intent)
                    }
                }
            }
        }

        @JavascriptInterface fun requestFullScreenIntentPermission() {
            activity.runOnUiThread {
                if (Build.VERSION.SDK_INT >= 34) {
                    val manager = activity.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                    if (!manager.canUseFullScreenIntent()) {
                        val intent = Intent(android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
                        intent.data = Uri.parse("package:" + activity.packageName)
                        activity.startActivity(intent)
                    }
                }
            }
        }

        @JavascriptInterface fun platformInfo(): String {
            val notifications = Build.VERSION.SDK_INT < 33 || activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            val exact = Build.VERSION.SDK_INT < 31 || (activity.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()
            val fullScreen = Build.VERSION.SDK_INT < 34 || (activity.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager).canUseFullScreenIntent()
            return JSONObject().put("platform", "android").put("exactAlarms", exact).put("notifications", notifications).put("fullScreenIntent", fullScreen).toString()
        }
    }
}
