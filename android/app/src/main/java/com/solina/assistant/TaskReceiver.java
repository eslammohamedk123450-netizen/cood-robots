package com.solina.assistant;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import org.json.JSONObject;

public class TaskReceiver extends BroadcastReceiver {
    public static final String ACTION_FIRE = "com.solina.assistant.FIRE_TASK";
    public static final String ACTION_STOP = "com.solina.assistant.STOP_TASK";
    public static final String ALARM_CHANNEL = "solina_alarms";
    public static final String REMINDER_CHANNEL = "solina_reminders";

    @Override public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra("task_id");
        if (id == null) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (ACTION_STOP.equals(intent.getAction())) {
            manager.cancel(id.hashCode());
            TaskStore.remove(context, id);
            return;
        }
        JSONObject task = TaskStore.find(context, id);
        if (task == null) return;
        createChannels(context, manager);
        boolean isAlarm = "alarm".equals(task.optString("type"));
        String title = isAlarm ? "سولينا — ميعاد الاستيقاظ" : "سولينا — تذكير";
        String body = task.optString("title");
        Intent open = new Intent(context, isAlarm ? AlarmActivity.class : MainActivity.class)
                .putExtra("task_id", id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPending = PendingIntent.getActivity(context, id.hashCode() + 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent stop = new Intent(context, AlarmActivity.class).putExtra("task_id", id).putExtra("stop_alarm", true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent stopPending = PendingIntent.getActivity(context, id.hashCode() + 2, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(context, isAlarm ? ALARM_CHANNEL : REMINDER_CHANNEL)
                : new Notification.Builder(context);
        builder.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(openPending).setAutoCancel(!isAlarm)
                .setCategory(isAlarm ? Notification.CATEGORY_ALARM : Notification.CATEGORY_REMINDER)
                .setPriority(isAlarm ? Notification.PRIORITY_MAX : Notification.PRIORITY_HIGH);
        if (isAlarm) builder.setOngoing(true).setFullScreenIntent(openPending, true)
                .addAction(android.R.drawable.ic_media_pause, "إيقاف", stopPending);
        manager.notify(id.hashCode(), builder.build());
        if (!isAlarm) TaskStore.remove(context, id);
    }

    private void createChannels(Context context, NotificationManager manager) {
        if (Build.VERSION.SDK_INT < 26) return;
        android.net.Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        NotificationChannel alarm = new NotificationChannel(ALARM_CHANNEL, "منبهات سولينا", NotificationManager.IMPORTANCE_HIGH);
        alarm.setDescription("تنبيهات الاستيقاظ من سولينا");
        alarm.enableVibration(true);
        if (sound != null) alarm.setSound(sound, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        NotificationChannel reminders = new NotificationChannel(REMINDER_CHANNEL, "تذكيرات سولينا", NotificationManager.IMPORTANCE_HIGH);
        reminders.setDescription("التذكيرات المجدولة من سولينا");
        manager.createNotificationChannel(alarm);
        manager.createNotificationChannel(reminders);
    }
}
