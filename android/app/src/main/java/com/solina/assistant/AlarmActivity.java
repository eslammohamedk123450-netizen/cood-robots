package com.solina.assistant;

import android.app.Activity;
import android.app.NotificationManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class AlarmActivity extends Activity {
    private Ringtone ringtone;
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
        TextView message = new TextView(this);
        org.json.JSONObject task = TaskStore.find(this, taskId);
        message.setText(task == null ? "حان موعد الاستيقاظ" : task.optString("title"));
        message.setTextSize(24);
        message.setGravity(Gravity.CENTER);
        message.setPadding(0, 32, 0, 48);
        layout.addView(message);
        Button stop = new Button(this);
        stop.setText("إيقاف المنبه");
        stop.setOnClickListener(view -> stopAlarm());
        layout.addView(stop);
        setContentView(layout);
        android.net.Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        ringtone = RingtoneManager.getRingtone(this, uri);
        if (Build.VERSION.SDK_INT >= 28 && ringtone != null) ringtone.setLooping(true);
        if (ringtone != null) ringtone.play();
    }

    private void stopAlarm() {
        if (ringtone != null) ringtone.stop();
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).cancel(taskId.hashCode());
        TaskStore.remove(this, taskId);
        finish();
    }

    @Override protected void onDestroy() {
        if (ringtone != null) ringtone.stop();
        super.onDestroy();
    }
}
