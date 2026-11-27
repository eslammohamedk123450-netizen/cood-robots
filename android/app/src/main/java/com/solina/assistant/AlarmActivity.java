package com.solina.assistant;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;

public class AlarmActivity extends Activity {
    private SpeechRecognizer speechRecognizer;
    private String taskId = "";

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        taskId = getIntent().getStringExtra("task_id");
        if (taskId == null) taskId = "";
        if (getIntent().getBooleanExtra("stop_alarm", false)) { stopAlarm(); return; }
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(32, 48, 32, 48);
        TextView brand = new TextView(this);
        brand.setText("سولينا");
        brand.setTextSize(32);
        brand.setGravity(Gravity.CENTER);
        layout.addView(brand);
        org.json.JSONObject task = TaskStore.find(this, taskId);
        boolean reminder = task != null && "reminder".equals(task.optString("type"));
        TextView message = new TextView(this);
        message.setText(task == null ? "حان موعدك" : task.optString("title"));
        message.setTextSize(24);
        message.setGravity(Gravity.CENTER);
        message.setPadding(0, 32, 0, 48);
        layout.addView(message);
        Button stop = new Button(this);
        stop.setText(reminder ? "خلصت — إيقاف التذكير" : "أنا قمت — إيقاف المنبه");
        stop.setOnClickListener(view -> stopAlarm());
        layout.addView(stop);
        TextView voiceHint = new TextView(this);
        voiceHint.setText(reminder ? "قولي: خلصت، أو خلاص، أو أوقفي التذكير" : "قولي: أنا قمت، أو خلاص، أو أوقفي المنبه");
        voiceHint.setTextSize(16);
        voiceHint.setGravity(Gravity.CENTER);
        layout.addView(voiceHint);
        setContentView(layout);
        Intent audio = new Intent(this, AlarmPlaybackService.class).setAction(AlarmPlaybackService.ACTION_START);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(audio); else startService(audio);
        startWakeWordRecognition();
    }

    private void stopAlarm() {
        stopWakeWordRecognition();
        stopService(new Intent(this, AlarmPlaybackService.class));
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).cancel(taskId.hashCode());
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).cancel(74102);
        AlarmScheduler.cancel(this, taskId);
        TaskStore.recordPendingSync(this, taskId, "completed", 0);
        TaskStore.remove(this, taskId);
        finish();
    }

    private void startWakeWordRecognition() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) return;
        try {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) { }
                @Override public void onBeginningOfSpeech() { }
                @Override public void onRmsChanged(float rmsdB) { }
                @Override public void onBufferReceived(byte[] buffer) { }
                @Override public void onEndOfSpeech() { }
                @Override public void onError(int error) { restartWakeRecognition(); }
                @Override public void onResults(Bundle results) {
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null) for (String phrase : matches) if (isStopPhrase(phrase)) { runOnUiThread(() -> stopAlarm()); return; }
                    restartWakeRecognition();
                }
                @Override public void onPartialResults(Bundle partial) {
                    ArrayList<String> matches = partial.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null) for (String phrase : matches) if (isStopPhrase(phrase)) { runOnUiThread(() -> stopAlarm()); return; }
                }
                @Override public void onEvent(int eventType, Bundle params) { }
            });
            launchWakeRecognition();
        } catch (Exception ignored) { }
    }

    private boolean isStopPhrase(String phrase) {
        String clean = phrase == null ? "" : phrase.toLowerCase(java.util.Locale.ROOT)
                .replaceAll("[\\p{Punct}\\s]", "").replace("أ", "ا").replace("إ", "ا");
        return clean.contains("انا قمت") || clean.contains("قمت") || clean.contains("صحيت") || clean.contains("صاحي")
                || clean.contains("خلصت") || clean.contains("انتهيت") || clean.contains("خلاص")
                || clean.contains("وقفت") || clean.contains("اوقفي المنبه") || clean.contains("اوقفي التذكير") || clean.contains("بطلي");
    }

    private void launchWakeRecognition() {
        if (speechRecognizer == null || isFinishing()) return;
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-EG");
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        try { speechRecognizer.startListening(intent); } catch (Exception ignored) { restartWakeRecognition(); }
    }

    private void restartWakeRecognition() {
        if (speechRecognizer == null || isFinishing()) return;
        new android.os.Handler(getMainLooper()).postDelayed(this::launchWakeRecognition, 700);
    }

    private void stopWakeWordRecognition() {
        if (speechRecognizer != null) {
            try { speechRecognizer.cancel(); speechRecognizer.destroy(); } catch (Exception ignored) { }
            speechRecognizer = null;
        }
    }

    @Override protected void onDestroy() {
        stopWakeWordRecognition();
        super.onDestroy();
    }
}