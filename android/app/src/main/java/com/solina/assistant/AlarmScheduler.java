package com.solina.assistant;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

public final class AlarmScheduler {
    private static final long DAY = 24L * 60L * 60L * 1000L;
    private static final long HOUR = 60L * 60L * 1000L;
    private static final long TEN_MINUTES = 10L * 60L * 1000L;
    private AlarmScheduler() { }

    private static int requestCode(String id, String stage) {
        return 31 * id.hashCode() + stage.hashCode();
    }

    private static void scheduleStage(Context context, String id, String stage, long at) {
        if (at <= 0) return;
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent receiver = new Intent(context, TaskReceiver.class)
                .setAction(TaskReceiver.ACTION_FIRE)
                .putExtra("task_id", id)
                .putExtra("stage", stage);
        PendingIntent pending = PendingIntent.getBroadcast(context, requestCode(id, stage), receiver,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (Build.VERSION.SDK_INT >= 23) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
        else manager.setExact(AlarmManager.RTC_WAKEUP, at, pending);
    }

    public static void schedule(Context context, JSONObject task) {
        String id = task.optString("id");
        long at = task.optLong("at");
        if ("alarm".equals(task.optString("type"))) {
            AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            Intent receiver = new Intent(context, TaskReceiver.class).setAction(TaskReceiver.ACTION_FIRE)
                    .putExtra("task_id", id).putExtra("stage", "alarm");
            PendingIntent pending = PendingIntent.getBroadcast(context, requestCode(id, "alarm"), receiver,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            PendingIntent show = PendingIntent.getActivity(context, requestCode(id, "show"),
                    new Intent(context, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            manager.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), pending);
            return;
        }
        long now = System.currentTimeMillis();
        if (at - DAY > now) scheduleStage(context, id, "day", at - DAY);
        if (at - HOUR > now) scheduleStage(context, id, "hour", at - HOUR);
        if (at - TEN_MINUTES > now) scheduleStage(context, id, "ten", at - TEN_MINUTES);
        scheduleStage(context, id, "due", at);
    }

    public static void scheduleFollowUp(Context context, String id, long at) {
        scheduleStage(context, id, "followup", at);
    }

    public static void cancel(Context context, String id) {
        for (String stage : new String[]{"alarm", "day", "hour", "ten", "due", "followup"}) {
            Intent receiver = new Intent(context, TaskReceiver.class).setAction(TaskReceiver.ACTION_FIRE)
                    .putExtra("task_id", id).putExtra("stage", stage);
            PendingIntent pending = PendingIntent.getBroadcast(context, requestCode(id, stage), receiver,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (pending != null) {
                ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).cancel(pending);
                pending.cancel();
            }
        }
        Intent show = new Intent(context, MainActivity.class);
        PendingIntent showPending = PendingIntent.getActivity(context, requestCode(id, "show"), show,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (showPending != null) showPending.cancel();
    }

    public static void rescheduleAll(Context context) {
        JSONArray rows = TaskStore.all(context);
        long now = System.currentTimeMillis();
        for (int i = 0; i < rows.length(); i++) {
            JSONObject task = rows.optJSONObject(i);
            if (task == null) continue;
            try {
                String id = task.optString("id");
                cancel(context, id);
                if ("alarm".equals(task.optString("type"))) {
                    if (task.optLong("at") > now) schedule(context, task);
                } else if (task.optLong("at") > now) {
                    schedule(context, task);
                } else {
                    long next = task.optLong("nextFollowUpAt");
                    scheduleFollowUp(context, id, next > now ? next : now + 1000L);
                }
            } catch (Exception ignored) { }
        }
    }
}
