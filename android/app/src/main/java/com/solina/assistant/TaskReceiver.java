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
import android.net.Uri;
import android.os.Build;
import org.json.JSONObject;

public class TaskReceiver extends BroadcastReceiver {
    public static final String ACTION_FIRE = "com.solina.assistant.FIRE_TASK";
    public static final String ACTION_STOP = "com.solina.assistant.STOP_TASK";
    public static final String ACTION_COMPLETE = "com.solina.assistant.COMPLETE_REMINDER";
    public static final String ACTION_SNOOZE = "com.solina.assistant.SNOOZE_REMINDER";
    public static final String ALARM_CHANNEL = "solina_alarms";
    public static final String REMINDER_CHANNEL = "solina_reminders";
    private static final long FOLLOW_UP_INTERVAL = 60L * 60L * 1000L;
    private static final long SNOOZE_INTERVAL = 10L * 60L * 1000L;

    @Override public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra("task_id");
        if (id == null || id.trim().isEmpty()) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (ACTION_COMPLETE.equals(intent.getAction()) || ACTION_STOP.equals(intent.getAction())) {
            AlarmScheduler.cancel(context, id);
            manager.cancel(id.hashCode());
            TaskStore.remove(context, id);
            return;
        }
        if (ACTION_SNOOZE.equals(intent.getAction())) {
            JSONObject task = TaskStore.find(context, id);
            if (task == null || !"reminder".equals(task.optString("type"))) return;
            long next = System.currentTimeMillis() + SNOOZE_INTERVAL;
            TaskStore.setNextFollowUp(context, id, next);
            AlarmScheduler.scheduleFollowUp(context, id, next);
            manager.cancel(id.hashCode());
            return;
        }

        JSONObject task = TaskStore.find(context, id);
        if (task == null) return;
        createChannels(context, manager);
        boolean isAlarm = "alarm".equals(task.optString("type"));
        String stage = intent.getStringExtra("stage");
        if (isAlarm || "alarm".equals(stage)) {
            showAlarm(context, manager, task, id);
            return;
        }

        boolean due = stage == null || "due".equals(stage) || "followup".equals(stage);
        if (due) {
            long next = System.currentTimeMillis() + FOLLOW_UP_INTERVAL;
            TaskStore.setNextFollowUp(context, id, next);
            AlarmScheduler.scheduleFollowUp(context, id, next);
        }
        showReminder(context, manager, task, id, stage, due);
    }

    private void showAlarm(Context context, NotificationManager manager, JSONObject task, String id) {
        Intent audio = new Intent(context, AlarmPlaybackService.class).setAction(AlarmPlaybackService.ACTION_START);
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(audio); else context.startService(audio);
        Intent alarmScreen = new Intent(context, AlarmActivity.class).putExtra("task_id", id)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try { context.startActivity(alarmScreen); } catch (Exception ignored) { }
        Intent open = new Intent(context, AlarmActivity.class).putExtra("task_id", id)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPending = PendingIntent.getActivity(context, id.hashCode() + 1, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent stop = new Intent(context, AlarmActivity.class).putExtra("task_id", id).putExtra("stop_alarm", true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent stopPending = PendingIntent.getActivity(context, id.hashCode() + 2, stop,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = notificationBuilder(context, ALARM_CHANNEL)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("سولينا — ميعاد الاستيقاظ")
                .setContentText(task.optString("title"))
                .setStyle(new Notification.BigTextStyle().bigText(task.optString("title")))
                .setContentIntent(openPending).setAutoCancel(false)
                .setCategory(Notification.CATEGORY_ALARM).setPriority(Notification.PRIORITY_MAX)
                .setOngoing(true).setFullScreenIntent(openPending, true)
                .addAction(android.R.drawable.ic_media_pause, "إيقاف", stopPending);
        manager.notify(id.hashCode(), builder.build());
    }

    private void showReminder(Context context, NotificationManager manager, JSONObject task, String id, String stage, boolean due) {
        String title = task.optString("title", "موعدك");
        String body;
        if ("day".equals(stage)) body = "فاضل يوم على موعدك: " + title;
        else if ("hour".equals(stage)) body = "فاضل ساعة على موعدك: " + title;
        else if ("ten".equals(stage)) body = "فاضل عشر دقايق على موعدك: " + title;
        else if ("followup".equals(stage)) body = "متابعة من سولينا: لسه ما أكدتيش إنك خلصتي " + title + ".";
        else body = "موعدك دلوقتي: " + title + ". لما تخلصي قولي «خلصت» أو اختاري التأجيل.";
        Intent open = new Intent(context, MainActivity.class).putExtra("task_id", id)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPending = PendingIntent.getActivity(context, id.hashCode() + 10, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent complete = actionPending(context, id, ACTION_COMPLETE, 20);
        PendingIntent snooze = actionPending(context, id, ACTION_SNOOZE, 30);
        Notification.Builder builder = notificationBuilder(context, REMINDER_CHANNEL)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(due ? "سولينا — متابعة الموعد" : "سولينا — تذكير مسبق")
                .setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(openPending).setCategory(Notification.CATEGORY_REMINDER)
                .setPriority(Notification.PRIORITY_HIGH).setAutoCancel(!due)
                .addAction(android.R.drawable.checkbox_on_background, "خلصت", complete)
                .addAction(android.R.drawable.ic_lock_idle_alarm, "بعد 10 دقايق", snooze);
        if (due) builder.setOngoing(true);
        manager.notify(id.hashCode(), builder.build());
    }

    private PendingIntent actionPending(Context context, String id, String action, int offset) {
        Intent intent = new Intent(context, TaskReceiver.class).setAction(action).putExtra("task_id", id);
        return PendingIntent.getBroadcast(context, id.hashCode() + offset, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification.Builder notificationBuilder(Context context, String channel) {
        return Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, channel) : new Notification.Builder(context);
    }

    private void createChannels(Context context, NotificationManager manager) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel alarm = new NotificationChannel(ALARM_CHANNEL, "منبهات سولينا", NotificationManager.IMPORTANCE_HIGH);
        alarm.setDescription("تنبيهات الاستيقاظ من سولينا");
        alarm.enableVibration(true);
        alarm.setSound(null, null);
        NotificationChannel reminders = new NotificationChannel(REMINDER_CHANNEL, "تذكيرات ومتابعة سولينا", NotificationManager.IMPORTANCE_HIGH);
        reminders.setDescription("تذكيرات قبل المواعيد ومتابعتها حتى تأكيد الانتهاء");
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        reminders.setSound(sound, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
        manager.createNotificationChannel(alarm);
        manager.createNotificationChannel(reminders);
    }
}
