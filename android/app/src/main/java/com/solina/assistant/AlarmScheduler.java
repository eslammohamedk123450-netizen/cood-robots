package com.solina.assistant;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

public final class AlarmScheduler {
    private AlarmScheduler() { }

    public static void schedule(Context context, JSONObject task) {
        String id = task.optString("id");
        long at = task.optLong("at");
        boolean isAlarm = "alarm".equals(task.optString("type"));
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent receiver = new Intent(context, TaskReceiver.class).setAction(TaskReceiver.ACTION_FIRE).putExtra("task_id", id);
        PendingIntent pending = PendingIntent.getBroadcast(context, id.hashCode(), receiver, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (isAlarm) {
            PendingIntent show = PendingIntent.getActivity(context, id.hashCode(), new Intent(context, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            manager.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), pending);
        } else if (Build.VERSION.SDK_INT >= 23) {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
        } else {
            manager.setExact(AlarmManager.RTC_WAKEUP, at, pending);
        }
    }

    public static void cancel(Context context, String id) {
        Intent receiver = new Intent(context, TaskReceiver.class).setAction(TaskReceiver.ACTION_FIRE).putExtra("task_id", id);
        PendingIntent pending = PendingIntent.getBroadcast(context, id.hashCode(), receiver, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (pending != null) {
            ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).cancel(pending);
            pending.cancel();
        }
    }

    public static void rescheduleAll(Context context) {
        JSONArray rows = TaskStore.all(context);
        long now = System.currentTimeMillis();
        for (int i = 0; i < rows.length(); i++) {
            JSONObject task = rows.optJSONObject(i);
            if (task == null) continue;
            if (task.optLong("at") > now) {
                try { schedule(context, task); } catch (Exception ignored) { }
            } else {
                TaskStore.remove(context, task.optString("id"));
            }
        }
    }
}
