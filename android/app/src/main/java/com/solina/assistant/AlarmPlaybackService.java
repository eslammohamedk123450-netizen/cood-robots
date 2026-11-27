package com.solina.assistant;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;

public class AlarmPlaybackService extends Service {
    public static final String ACTION_START = "com.solina.assistant.START_ALARM_AUDIO";
    public static final String ACTION_STOP = "com.solina.assistant.STOP_ALARM_AUDIO";
    private static final int NOTIFICATION_ID = 74102;
    private MediaPlayer player;

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopPlayback(); stopForeground(true); stopSelf(); return START_NOT_STICKY;
        }
        startForeground(NOTIFICATION_ID, buildNotification());
        if (player == null) startPlayback();
        return START_STICKY;
    }

    private Notification buildNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel("solina_alarm_audio", "صوت منبه سولينا", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("صوت مستمر حتى إيقاف منبه الاستيقاظ");
            manager.createNotificationChannel(channel);
        }
        Intent open = new Intent(this, AlarmActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(this, NOTIFICATION_ID, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "solina_alarm_audio") : new Notification.Builder(this);
        return builder.setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle("سولينا — منبه الاستيقاظ")
                .setContentText("التنبيه مستمر. قولي: أنا قمت، أو أوقفي المنبه.")
                .setCategory(Notification.CATEGORY_ALARM).setOngoing(true).setContentIntent(pending)
                .setPriority(Notification.PRIORITY_MAX).build();
    }

    private void startPlayback() {
        try {
            Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            player.setDataSource(this, sound);
            player.setLooping(true);
            player.setOnPreparedListener(MediaPlayer::start);
            player.setOnErrorListener((mp, what, extra) -> { stopPlayback(); return true; });
            player.prepareAsync();
        } catch (Exception ignored) { stopPlayback(); }
    }

    private void stopPlayback() {
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) { }
            try { player.release(); } catch (Exception ignored) { }
            player = null;
        }
    }
    @Override public void onDestroy() { stopPlayback(); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}