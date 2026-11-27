package com.solina.assistant;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.media.AudioAttributes;
import java.util.Locale;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.UUID;

// Device task commands and alarm dismissal are handled natively by the Android app. 
public class MainActivity extends Activity {
    private WebView webView;
    private SpeechRecognizer speechRecognizer;
    private TextToSpeech textToSpeech;
    private boolean ttsReady = false;
    private String pendingTtsText = null;
    private final String appUrl = "https://eslammohamedk123450-netizen.github.io/cood-robots/?solina=account-items-v4";

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        textToSpeech = new TextToSpeech(this, status -> {
            if (status != TextToSpeech.SUCCESS) {
                ttsReady = false;
                dispatchTtsEvent("error", "تعذر تهيئة محرك تحويل النص إلى كلام في أندرويد.");
                return;
            }
            int language = textToSpeech.setLanguage(new Locale("ar", "EG"));
            if (language < TextToSpeech.LANG_AVAILABLE) language = textToSpeech.setLanguage(new Locale("ar"));
            if (language < TextToSpeech.LANG_AVAILABLE) language = textToSpeech.setLanguage(Locale.getDefault());
            if (language < TextToSpeech.LANG_AVAILABLE) {
                ttsReady = false;
                dispatchTtsEvent("error", "حزمة الصوت العربية غير مثبتة على الجهاز.");
                return;
            }
            if (Build.VERSION.SDK_INT >= 21) {
                textToSpeech.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANT)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build());
            }
            ttsReady = true;
            if (pendingTtsText != null) {
                String pending = pendingTtsText;
                pendingTtsText = null;
                speakNativeTextNow(pending);
            }
        });
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        webView.addJavascriptInterface(new SolinaBridge(this), "SolinaNative");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return !"https".equals(uri.getScheme()) || !"eslammohamedk123450-netizen.github.io".equals(uri.getHost());
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    ArrayList<String> allowed = new ArrayList<>();
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                                && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            allowed.add(resource);
                        }
                    }
                    if (allowed.isEmpty()) request.deny();
                    else request.grant(allowed.toArray(new String[0]));
                });
            }
        });
        setContentView(webView);
        webView.loadUrl(appUrl);
        requestStartupPermissions();
    }

    private void dispatchTtsEvent(String event, String message) {
        if (webView == null) return;
        String script = "window.dispatchEvent(new CustomEvent('solina-native-tts',{detail:{event:"
                + JSONObject.quote(event) + ",message:" + JSONObject.quote(message == null ? "" : message) + "}}));";
        runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript(script, null); });
    }

    private void speakNativeTextNow(String text) {
        if (!ttsReady || textToSpeech == null) {
            dispatchTtsEvent("error", "محرك الصوت في أندرويد غير جاهز.");
            return;
        }
        textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String utteranceId) { dispatchTtsEvent("start", ""); }
            @Override public void onDone(String utteranceId) { dispatchTtsEvent("done", ""); }
            @Override public void onError(String utteranceId) { dispatchTtsEvent("error", "محرك أندرويد فشل في إخراج الصوت."); }
            @Override public void onError(String utteranceId, int errorCode) { dispatchTtsEvent("error", "فشل إخراج الصوت، رمز الخطأ " + errorCode); }
        });
        int result = textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "solina-" + System.currentTimeMillis());
        if (result == TextToSpeech.ERROR) dispatchTtsEvent("error", "تعذر بدء النطق على الجهاز.");
    }

    void dispatchSpeechResult(JSONArray transcripts) {
        if (webView == null) return;
        String script = "window.dispatchEvent(new CustomEvent('solina-native-speech-result',{detail:{transcripts:" + transcripts.toString() + "}}));";
        runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    void dispatchSpeechError(int error) {
        if (webView == null) return;
        String script = "window.dispatchEvent(new CustomEvent('solina-native-speech-error',{detail:{code:" + error + "}}));";
        runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    void startNativeSpeechRecognition() {
        runOnUiThread(() -> {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 2101);
                dispatchSpeechError(9);
                return;
            }
            if (!SpeechRecognizer.isRecognitionAvailable(this)) {
                dispatchSpeechError(5);
                return;
            }
            stopNativeSpeechRecognition();
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) { }
                @Override public void onBeginningOfSpeech() { }
                @Override public void onRmsChanged(float rmsdB) { }
                @Override public void onBufferReceived(byte[] buffer) { }
                @Override public void onEndOfSpeech() { }
                @Override public void onError(int error) { dispatchSpeechError(error); }
                @Override public void onResults(Bundle results) {
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    JSONArray values = new JSONArray();
                    if (matches != null) for (String match : matches) values.put(match);
                    dispatchSpeechResult(values);
                }
                @Override public void onPartialResults(Bundle partialResults) { }
                @Override public void onEvent(int eventType, Bundle params) { }
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-EG");
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ar-EG");
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            speechRecognizer.startListening(intent);
        });
    }

    void stopNativeSpeechRecognition() {
        if (speechRecognizer != null) {
            try { speechRecognizer.cancel(); } catch (Exception ignored) { }
            try { speechRecognizer.destroy(); } catch (Exception ignored) { }
            speechRecognizer = null;
        }
    }

    @Override protected void onResume() {
        super.onResume();
        dispatchTaskPermissionUpdate();
    }

    private void requestStartupPermissions() {
        if (Build.VERSION.SDK_INT < 23) return;
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 2101);
            return;
        }
        requestStartupNotificationPermission();
    }

    private void requestStartupNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        android.content.SharedPreferences preferences = getSharedPreferences("solina_permissions", MODE_PRIVATE);
        if (preferences.getBoolean("startup_notification_prompted", false)) return;
        preferences.edit().putBoolean("startup_notification_prompted", true).apply();
        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 2102);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 2101) {
            requestStartupNotificationPermission();
            dispatchTaskPermissionUpdate();
        } else if (requestCode == 2102) {
            dispatchTaskPermissionUpdate();
        }
    }

    private void dispatchTaskPermissionUpdate() {
        if (webView == null) return;
        runOnUiThread(() -> webView.evaluateJavascript(
                "window.dispatchEvent(new Event('solina-task-permissions-updated'));", null));
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        stopNativeSpeechRecognition();
        if (textToSpeech != null) { textToSpeech.stop(); textToSpeech.shutdown(); textToSpeech = null; }
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    public static class SolinaBridge {
        private final MainActivity activity;
        SolinaBridge(MainActivity activity) { this.activity = activity; }

        @JavascriptInterface public String scheduleTask(String raw) {
            try {
                JSONObject task = new JSONObject(raw);
                String id = task.optString("id");
                if (id.isEmpty()) id = UUID.randomUUID().toString();
                String type = task.optString("type");
                String title = task.optString("title");
                if (title.length() > 120) title = title.substring(0, 120);
                long at = task.optLong("at");
                if (!(type.equals("alarm") || type.equals("reminder")) || title.trim().isEmpty() || at <= System.currentTimeMillis()) {
                    return new JSONObject().put("ok", false).put("error", "invalid_task").toString();
                }
                AlarmManager manager = (AlarmManager) activity.getSystemService(Context.ALARM_SERVICE);
                if (Build.VERSION.SDK_INT >= 31 && !manager.canScheduleExactAlarms()) {
                    return new JSONObject().put("ok", false).put("error", "exact_alarm_permission_required").toString();
                }
                // Alarm audio is delivered by AlarmManager + a foreground playback service.
                // Notification permission controls the optional notification UI only.
                JSONObject saved = new JSONObject().put("id", id).put("type", type).put("title", title).put("at", at);
                try {
                    TaskStore.upsert(activity, saved);
                    AlarmScheduler.schedule(activity, saved);
                } catch (Exception error) {
                    TaskStore.remove(activity, id);
                    throw error;
                }
                return new JSONObject().put("ok", true).put("task", saved).toString();
            } catch (Exception error) {
                try { return new JSONObject().put("ok", false).put("error", error.getMessage() == null ? "schedule_failed" : error.getMessage()).toString(); }
                catch (Exception ignored) { return "{\"ok\":false,\"error\":\"schedule_failed\"}"; }
            }
        }

        @JavascriptInterface public String openApp(String requestedName) {
            try {
                String wanted = normalizeAppLabel(requestedName);
                if (wanted.isEmpty()) return new JSONObject().put("ok", false).put("error", "empty_app_name").toString();
                Intent query = new Intent(Intent.ACTION_MAIN, null);
                query.addCategory(Intent.CATEGORY_LAUNCHER);
                java.util.List<android.content.pm.ResolveInfo> apps = activity.getPackageManager().queryIntentActivities(query, 0);
                android.content.pm.ResolveInfo best = null;
                int bestScore = 0;
                for (android.content.pm.ResolveInfo info : apps) {
                    CharSequence label = info.loadLabel(activity.getPackageManager());
                    String candidate = normalizeAppLabel(label == null ? "" : label.toString());
                    if (candidate.isEmpty()) continue;
                    // Prefer exact app names. Never mistake Facebook Lite for Facebook (or vice versa).
                    if ("facebook".equals(wanted) && candidate.contains("facebooklite")) continue;
                    if ("facebooklite".equals(wanted) && !candidate.contains("facebooklite")) continue;
                    int score = candidate.equals(wanted) ? 100 : candidate.contains(wanted) ? 80 : wanted.contains(candidate) ? 60 : 0;
                    if (score > bestScore) { best = info; bestScore = score; }
                }
                if (best == null || bestScore < 60) return new JSONObject().put("ok", false).put("error", "app_not_found").toString();
                String packageName = best.activityInfo.packageName;
                Intent launch = activity.getPackageManager().getLaunchIntentForPackage(packageName);
                if (launch == null) return new JSONObject().put("ok", false).put("error", "app_not_launchable").toString();
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.runOnUiThread(() -> activity.startActivity(launch));
                return new JSONObject().put("ok", true).put("app", best.loadLabel(activity.getPackageManager()).toString()).toString();
            } catch (Exception error) {
                try { return new JSONObject().put("ok", false).put("error", "open_app_failed").toString(); }
                catch (Exception ignored) { return "{\"ok\":false}"; }
            }
        }

        @JavascriptInterface public String openSettings() {
            try {
                Intent intent = new Intent(android.provider.Settings.ACTION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.runOnUiThread(() -> activity.startActivity(intent));
                return new JSONObject().put("ok", true).toString();
            } catch (Exception error) {
                return "{\"ok\":false,\"error\":\"settings_unavailable\"}";
            }
        }

        private String normalizeAppLabel(String value) {
            String normalized = String.valueOf(value == null ? "" : value).toLowerCase(java.util.Locale.ROOT)
                    .replaceAll("[\\s\\p{Punct}]", "").replace("ال", "");
            switch (normalized) {
                case "واتساب": return "whatsapp";
                case "يوتيوب": return "youtube";
                case "فيسبوكلايت":
                case "فيسبوكلايتت": return "facebooklite";
                case "فيسبوك": return "facebook";
                case "انستجرام":
                case "انستغرام": return "instagram";
                case "تيليجرام": return "telegram";
                case "كروم": return "chrome";
                case "كاميرا": return "camera";
                case "ساعة": return "clock";
                case "صور": return "photos";
                default: return normalized;
            }
        }

        @JavascriptInterface public String listTasks() { return TaskStore.all(activity).toString(); }
        @JavascriptInterface public String pendingTaskSyncEvents() { return TaskStore.pendingSyncEvents(activity).toString(); }
        @JavascriptInterface public void acknowledgeTaskSyncEvent(String id) { TaskStore.acknowledgePendingSync(activity, id); }

        @JavascriptInterface public String completeTask(String id) {
            try {
                JSONObject task = TaskStore.find(activity, id);
                if (task == null || !"reminder".equals(task.optString("type"))) {
                    return new JSONObject().put("ok", false).put("error", "reminder_not_found").toString();
                }
                AlarmScheduler.cancel(activity, id);
                ((NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(id.hashCode());
                TaskStore.remove(activity, id);
                return new JSONObject().put("ok", true).toString();
            } catch (Exception error) {
                return "{\"ok\":false,\"error\":\"complete_failed\"}";
            }
        }

        @JavascriptInterface public String snoozeTask(String id, int minutes) {
            try {
                JSONObject task = TaskStore.find(activity, id);
                if (task == null || !"reminder".equals(task.optString("type"))) {
                    return new JSONObject().put("ok", false).put("error", "reminder_not_found").toString();
                }
                int safeMinutes = Math.max(1, Math.min(1440, minutes));
                long next = System.currentTimeMillis() + safeMinutes * 60L * 1000L;
                TaskStore.setNextFollowUp(activity, id, next);
                AlarmScheduler.scheduleFollowUp(activity, id, next);
                ((NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(id.hashCode());
                return new JSONObject().put("ok", true).put("nextAt", next).toString();
            } catch (Exception error) {
                return "{\"ok\":false,\"error\":\"snooze_failed\"}";
            }
        }

        @JavascriptInterface public String cancelTask(String id) {
            try {
                AlarmScheduler.cancel(activity, id);
                TaskStore.remove(activity, id);
                return new JSONObject().put("ok", true).toString();
            } catch (Exception error) {
                try { return new JSONObject().put("ok", false).put("error", "cancel_failed").toString(); }
                catch (Exception ignored) { return "{\"ok\":false}"; }
            }
        }

        @JavascriptInterface public void requestNotificationPermission() {
            activity.runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    android.content.SharedPreferences preferences = activity.getSharedPreferences("solina_permissions", MODE_PRIVATE);
                    boolean askedBefore = preferences.getBoolean("startup_notification_prompted", false);
                    if (askedBefore && !activity.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                        Intent settings = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                        settings.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, activity.getPackageName());
                        activity.startActivity(settings);
                    } else {
                        preferences.edit().putBoolean("startup_notification_prompted", true).apply();
                        activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 2102);
                    }
                }
            });
        }

        @JavascriptInterface public void requestExactAlarmPermission() {
            activity.runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 31) {
                    AlarmManager manager = (AlarmManager) activity.getSystemService(Context.ALARM_SERVICE);
                    if (!manager.canScheduleExactAlarms()) {
                        Intent intent = new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                        intent.setData(Uri.parse("package:" + activity.getPackageName()));
                        activity.startActivity(intent);
                    }
                }
            });
        }

        @JavascriptInterface public void requestFullScreenIntentPermission() {
            activity.runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 34) {
                    NotificationManager manager = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
                    if (!manager.canUseFullScreenIntent()) {
                        Intent intent = new Intent(android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                        intent.setData(Uri.parse("package:" + activity.getPackageName()));
                        activity.startActivity(intent);
                    }
                }
            });
        }

        @JavascriptInterface public void requestPermission(String name) {
            activity.runOnUiThread(() -> {
                if ("microphone".equals(name)) {
                    if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        android.content.SharedPreferences prefs = activity.getSharedPreferences("solina_permissions", MODE_PRIVATE);
                        boolean asked = prefs.getBoolean("microphone_prompted", false);
                        if (asked && !activity.shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO)) {
                            Intent settings = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(Uri.parse("package:" + activity.getPackageName()));
                            activity.startActivity(settings);
                        } else {
                            prefs.edit().putBoolean("microphone_prompted", true).apply();
                            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 2101);
                        }
                    }
                } else if ("notifications".equals(name)) {
                    requestNotificationPermission();
                } else if ("exactAlarms".equals(name)) {
                    requestExactAlarmPermission();
                } else if ("fullScreenIntent".equals(name)) {
                    requestFullScreenIntentPermission();
                } else if ("appSettings".equals(name)) {
                    Intent settings = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(Uri.parse("package:" + activity.getPackageName()));
                    activity.startActivity(settings);
                }
            });
        }

        @JavascriptInterface public String permissionInfo() {
            AlarmManager alarms = (AlarmManager) activity.getSystemService(Context.ALARM_SERVICE);
            NotificationManager manager = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
            boolean microphone = activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
            boolean notifications = Build.VERSION.SDK_INT < 33 || activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
            boolean exact = Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms();
            boolean fullScreen = Build.VERSION.SDK_INT < 34 || manager.canUseFullScreenIntent();
            try {
                return new JSONObject().put("platform", "android").put("microphone", microphone)
                        .put("notifications", notifications).put("exactAlarms", exact)
                        .put("fullScreenIntent", fullScreen).toString();
            } catch (Exception ignored) { return "{}"; }
        }

        @JavascriptInterface public String platformInfo() {
            AlarmManager alarms = (AlarmManager) activity.getSystemService(Context.ALARM_SERVICE);
            NotificationManager notificationsManager = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
            boolean notifications = Build.VERSION.SDK_INT < 33 || activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
            boolean exact = Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms();
            boolean fullScreen = Build.VERSION.SDK_INT < 34 || notificationsManager.canUseFullScreenIntent();
            try {
                return new JSONObject().put("platform", "android").put("exactAlarms", exact).put("notifications", notifications).put("fullScreenIntent", fullScreen).toString();
            } catch (Exception ignored) { return "{\"platform\":\"android\"}"; }
        }

        @JavascriptInterface public String speakText(String text) {
            if (text == null || text.trim().isEmpty()) return "{\"ok\":false,\"error\":\"empty_text\"}";
            String safeText = text.length() > 3900 ? text.substring(0, 3900) : text;
            activity.runOnUiThread(() -> {
                if (activity.ttsReady) activity.speakNativeTextNow(safeText);
                else activity.pendingTtsText = safeText;
            });
            return "{\"ok\":true,\"queued\":true}";
        }
        @JavascriptInterface public void stopSpeaking() {
            activity.runOnUiThread(() -> {
                activity.pendingTtsText = null;
                if (activity.textToSpeech != null) activity.textToSpeech.stop();
            });
        }
        @JavascriptInterface public boolean isTtsReady() { return activity.ttsReady; }
        @JavascriptInterface public void startSpeechRecognition() { activity.startNativeSpeechRecognition(); }
        @JavascriptInterface public void stopSpeechRecognition() { activity.runOnUiThread(activity::stopNativeSpeechRecognition); }
    }
}
