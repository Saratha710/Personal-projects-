package com.sara.dailywisdom;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.Vibrator;

/** Rings like an alarm clock until stopped, snoozed, or one minute has passed. */
public class AlarmService extends Service {
    static final String ACTION_RING = "ring";
    static final String ACTION_STOP = "stop";
    static final String ACTION_SNOOZE = "snooze";
    /** Tells an open alarm screen to close. */
    static final String BROADCAST_FINISHED = "com.sara.dailywisdom.ALARM_FINISHED";
    private static final String EXTRA_QUOTE = "quote";
    private static final long RING_LIMIT_MS = 60_000L;
    private static final long[] VIBRATION = {0, 700, 500};

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable timeout = new Runnable() {
        @Override public void run() { finish(); }
    };
    private MediaPlayer player;
    private Vibrator vibrator;

    static void start(Context context, int quoteIndex) {
        Intent intent = new Intent(context, AlarmService.class)
                .setAction(ACTION_RING).putExtra(EXTRA_QUOTE, quoteIndex);
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
        else context.startService(intent);
    }

    static Intent command(Context context, String action) {
        return new Intent(context, AlarmService.class).setAction(action);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_STOP : intent.getAction();
        if (ACTION_RING.equals(action)) {
            ring(intent.getIntExtra(EXTRA_QUOTE, 0));
            return START_NOT_STICKY;
        }
        if (ACTION_SNOOZE.equals(action)) Alarms.snooze(this);
        finish();
        return START_NOT_STICKY;
    }

    private void ring(int quoteIndex) {
        stopSound();
        handler.removeCallbacks(timeout);
        Notifier.ensureAlarmChannel(this);
        startForeground(Notifier.ID_ALARM, buildNotification(quoteIndex));
        Prefs prefs = new Prefs(this);
        playTone(prefs.alarmTone());
        if (prefs.vibrate()) vibrate();
        handler.postDelayed(timeout, RING_LIMIT_MS);
    }

    private Notification buildNotification(int quoteIndex) {
        Quotes.Quote quote = Quotes.all(this).get(quoteIndex);
        Intent screen = new Intent(this, AlarmActivity.class)
                .putExtra(AlarmActivity.EXTRA_QUOTE, quoteIndex)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        PendingIntent full = PendingIntent.getActivity(this, 100, screen,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Notifier.builder(this, Notifier.CHANNEL_ALARM)
                .setSmallIcon(R.drawable.ic_stat_quote)
                .setContentTitle(quote.author)
                .setContentText(quote.text)
                .setStyle(new Notification.BigTextStyle().bigText(quote.withMeaning(this)).setSummaryText(quote.work))
                .setCategory(Notification.CATEGORY_ALARM)
                .setPriority(Notification.PRIORITY_MAX)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setContentIntent(full)
                .setFullScreenIntent(full, true)
                .addAction(action(R.string.alarm_stop, ACTION_STOP, 101))
                .addAction(action(R.string.alarm_snooze, ACTION_SNOOZE, 102));
        return b.build();
    }

    private Notification.Action action(int title, String command, int request) {
        PendingIntent pending = PendingIntent.getService(this, request, command(this, command),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Action.Builder(null, getString(title), pending).build();
    }

    private void playTone(String saved) {
        Uri tone = Notifier.toneUri(saved, RingtoneManager.TYPE_ALARM);
        if (tone == null) return;
        if (!tryPlay(tone)) tryPlay(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM));
    }

    private boolean tryPlay(Uri tone) {
        MediaPlayer mp = new MediaPlayer();
        try {
            mp.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            mp.setDataSource(this, tone);
            mp.setLooping(true);
            mp.prepare();
            mp.start();
            player = mp;
            return true;
        } catch (Exception badTone) {
            mp.release();
            return false;
        }
    }

    private void vibrate() {
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        vibrator.vibrate(VIBRATION, 0, new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM).build());
    }

    private void stopSound() {
        if (player != null) {
            try {
                player.stop();
            } catch (IllegalStateException ignored) {
                // Already stopped.
            }
            player.release();
            player = null;
        }
        if (vibrator != null) {
            vibrator.cancel();
            vibrator = null;
        }
    }

    private void finish() {
        handler.removeCallbacks(timeout);
        stopSound();
        sendBroadcast(new Intent(BROADCAST_FINISHED).setPackage(getPackageName()));
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(timeout);
        stopSound();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
