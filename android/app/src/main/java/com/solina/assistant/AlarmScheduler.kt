package com.solina.assistant

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONObject

object AlarmScheduler {
    fun schedule(context: Context, task: JSONObject) {
        val id = task.getString("id")
        val at = task.getLong("at")
        val type = task.getString("type")
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, TaskReceiver::class.java).setAction(TaskReceiver.ACTION_FIRE).putExtra("task_id", id)
        val pending = PendingIntent.getBroadcast(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        if (type == "alarm") {
            val showIntent = PendingIntent.getActivity(context, id.hashCode(), Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            alarmManager.setAlarmClock(AlarmManager.AlarmClockInfo(at, showIntent), pending)
        } else if (Build.VERSION.SDK_INT >= 23) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, at, pending)
        }
    }

    fun cancel(context: Context, id: String) {
        val intent = Intent(context, TaskReceiver::class.java).setAction(TaskReceiver.ACTION_FIRE).putExtra("task_id", id)
        val pending = PendingIntent.getBroadcast(context, id.hashCode(), intent, PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)
        if (pending != null) {
            (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pending)
            pending.cancel()
        }
    }

    fun rescheduleAll(context: Context) {
        val rows = TaskStore.all(context)
        val now = System.currentTimeMillis()
        for (i in 0 until rows.length()) {
            val task = rows.optJSONObject(i) ?: continue
            if (task.optLong("at") > now) {
                try { schedule(context, task) } catch (_: Exception) { }
            } else TaskStore.remove(context, task.optString("id"))
        }
    }
}
