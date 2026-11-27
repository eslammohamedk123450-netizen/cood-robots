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

public class MainActivity extends Activity {
    private WebView webView;
    private SpeechRecognizer speechRecognizer;
    private final String appUrl = "https://eslammohamedk123450-netizen.github.io/cood-robots/?solina=command-router-v2";

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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
        ArrayList<String> needed = new ArrayList<>();
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) needed.add(Manifest.permission.RECORD_AUDIO);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) needed.add(Manifest.permission.POST_NOTIFICATIONS);
        if (!needed.isEmpty()) requestPermissions(needed.toArray(new String[0]), 2101);
        webView.loadUrl(appUrl);
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

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        stopNativeSpeechRecognition();
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
                if (Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    return new JSONObject().put("ok", false).put("error", "notification_permission_required").toString();
                }
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
                catch (Exception ignored) { return "{\\"ok\\":false}"; }
            }
        }

        @JavascriptInterface public String openSettings() {
            try {
                Intent intent = new Intent(android.provider.Settings.ACTION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.runOnUiThread(() -> activity.startActivity(intent));
                return new JSONObject().put("ok", true).toString();
            } catch (Exception error) {
                return "{\\"ok\\":false,\\"error\\":\\"settings_unavailable\\"}";
            }
        }

        private String normalizeAppLabel(String value) {
            String normalized = String.valueOf(value == null ? "" : value).toLowerCase(java.util.Locale.ROOT)
                    .replaceAll("[\\s\\p{Punct}]", "").replace("ال", "");
            switch (normalized) {
                case "واتساب": return "whatsapp";
                case "يوتيوب": return "youtube";
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
                    activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 2102);
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

        @JavascriptInterface public void startSpeechRecognition() { activity.startNativeSpeechRecognition(); }
        @JavascriptInterface public void stopSpeechRecognition() { activity.runOnUiThread(activity::stopNativeSpeechRecognition); }
    }
}
