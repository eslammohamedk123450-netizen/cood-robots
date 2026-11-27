package com.solina.assistant

import android.app.Activity
import android.app.NotificationManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class AlarmActivity : Activity() {
    private var ringtone: Ringtone? = null
    private var taskId: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        taskId = intent.getStringExtra("task_id") ?: ""
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(32, 48, 32, 48)
        }
        layout.addView(TextView(this).apply { text = "سولينا"; textSize = 32f; gravity = Gravity.CENTER })
        layout.addView(TextView(this).apply {
            text = TaskStore.find(this@AlarmActivity, taskId)?.optString("title") ?: "حان موعد الاستيقاظ"
            textSize = 24f; gravity = Gravity.CENTER; setPadding(0, 32, 0, 48)
        })
        layout.addView(Button(this).apply {
            text = "إيقاف المنبه"
            setOnClickListener { stopAlarm() }
        })
        setContentView(layout)
        val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        ringtone = RingtoneManager.getRingtone(this, uri)
        if (Build.VERSION.SDK_INT >= 28) ringtone?.isLooping = true
        ringtone?.play()
    }

    private fun stopAlarm() {
        ringtone?.stop()
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).cancel(taskId.hashCode())
        TaskStore.remove(this, taskId)
        finish()
    }

    override fun onDestroy() {
        ringtone?.stop()
        super.onDestroy()
    }
}
