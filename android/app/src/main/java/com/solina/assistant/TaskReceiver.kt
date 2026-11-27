package com.solina.assistant

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import org.json.JSONObject

class TaskReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra("task_id") ?: return
        if (intent.action == ACTION_STOP) {
            (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(id.hashCode())
            return
        }
        val task = TaskStore.find(context, id) ?: return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createChannels(context, manager)
        val isAlarm = task.optString("type") == "alarm"
        val title = if (isAlarm) "سولينا — ميعاد الاستيقاظ" else "سولينا — تذكير"
        val body = task.optString("title")
        val openIntent = Intent(context, if (isAlarm) AlarmActivity::class.java else MainActivity::class.java)
            .putExtra("task_id", id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val openPending = PendingIntent.getActivity(context, id.hashCode() + 1, openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val stopIntent = Intent(context, TaskReceiver::class.java).setAction(ACTION_STOP).putExtra("task_id", id)
        val stopPending = PendingIntent.getBroadcast(context, id.hashCode() + 2, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, if (isAlarm) ALARM_CHANNEL else REMINDER_CHANNEL) else Notification.Builder(context)
        builder.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title).setContentText(body).setStyle(Notification.BigTextStyle().bigText(body))
            .setContentIntent(openPending).setAutoCancel(!isAlarm).setCategory(if (isAlarm) Notification.CATEGORY_ALARM else Notification.CATEGORY_REMINDER)
            .setPriority(if (isAlarm) Notification.PRIORITY_MAX else Notification.PRIORITY_HIGH)
        if (isAlarm) {
            builder.setOngoing(true).setFullScreenIntent(openPending, true).addAction(android.R.drawable.ic_media_pause, "إيقاف", stopPending)
        }
        manager.notify(id.hashCode(), builder.build())
        if (!isAlarm) TaskStore.remove(context, id)
    }

    private fun createChannels(context: Context, manager: NotificationManager) {
        if (Build.VERSION.SDK_INT < 26) return
        val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        val alarm = NotificationChannel(ALARM_CHANNEL, "منبهات سولينا", NotificationManager.IMPORTANCE_HIGH)
        alarm.description = "تنبيهات الاستيقاظ من سولينا"
        alarm.enableVibration(true)
        if (alarmSound != null) alarm.setSound(alarmSound, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        val reminders = NotificationChannel(REMINDER_CHANNEL, "تذكيرات سولينا", NotificationManager.IMPORTANCE_HIGH)
        reminders.description = "التذكيرات المجدولة من سولينا"
        manager.createNotificationChannel(alarm)
        manager.createNotificationChannel(reminders)
    }

    companion object {
        const val ACTION_FIRE = "com.solina.assistant.FIRE_TASK"
        const val ACTION_STOP = "com.solina.assistant.STOP_TASK"
        const val ALARM_CHANNEL = "solina_alarms"
        const val REMINDER_CHANNEL = "solina_reminders"
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        AlarmScheduler.rescheduleAll(context)
    }
}
