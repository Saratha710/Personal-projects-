package com.sara.dailywisdom;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import java.util.List;

/** Builds and posts the quote notification, and manages the notification channels. */
final class Notifier {
    static final int ID_QUOTE = 1;
    static final int ID_ALARM = 2;
    static final String CHANNEL_ALARM = "alarm";
    private static final String CHANNEL_QUOTE_PREFIX = "quotes_";
    private static final long[] VIBRATION = {0, 300, 200, 300};

    private Notifier() {}

    static void deliver(Context context, int quoteIndex, int style) {
        if (style == Prefs.STYLE_ALARM) {
            try {
                AlarmService.start(context, quoteIndex);
                return;
            } catch (RuntimeException blocked) {
                // Android refused to start the ringing service; a normal notification is better than nothing.
            }
        }
        postNotification(context, quoteIndex);
    }

    private static void postNotification(Context context, int quoteIndex) {
        Prefs prefs = new Prefs(context);
        Quotes.Quote quote = Quotes.all(context).get(quoteIndex);
        Notification.Builder b = builder(context, quoteChannelId(context))
                .setSmallIcon(R.drawable.ic_stat_quote)
                .setContentTitle(quote.author)
                .setContentText(quote.text)
                .setStyle(new Notification.BigTextStyle().bigText(quote.withMeaning(context)).setSummaryText(quote.work))
                .setContentIntent(openQuote(context, quoteIndex))
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setPriority(Notification.PRIORITY_HIGH);
        if (Build.VERSION.SDK_INT < 26) {
            Uri tone = toneUri(prefs.notificationTone(), RingtoneManager.TYPE_NOTIFICATION);
            if (tone != null) b.setSound(tone);
            if (prefs.vibrate()) b.setVibrate(VIBRATION);
        }
        manager(context).notify(ID_QUOTE, b.build());
    }

    static Notification.Builder builder(Context context, String channelId) {
        return Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(context, channelId)
                : new Notification.Builder(context);
    }

    static PendingIntent openQuote(Context context, int quoteIndex) {
        Intent intent = new Intent(context, MainActivity.class)
                .putExtra(MainActivity.EXTRA_QUOTE, quoteIndex)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, quoteIndex, intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static Uri toneUri(String saved, int fallbackType) {
        if (saved == null) return RingtoneManager.getDefaultUri(fallbackType);
        return saved.isEmpty() ? null : Uri.parse(saved);
    }

    /** Returns the channel for the current tone, creating it and clearing out older ones. */
    private static String quoteChannelId(Context context) {
        Prefs prefs = new Prefs(context);
        String id = CHANNEL_QUOTE_PREFIX + prefs.channelVersion();
        if (Build.VERSION.SDK_INT < 26) return id;

        NotificationManager manager = manager(context);
        List<NotificationChannel> existing = manager.getNotificationChannels();
        for (NotificationChannel channel : existing) {
            String other = channel.getId();
            if (other.startsWith(CHANNEL_QUOTE_PREFIX) && !other.equals(id)) {
                manager.deleteNotificationChannel(other);
            }
        }
        NotificationChannel channel = new NotificationChannel(id,
                context.getString(R.string.channel_quotes), NotificationManager.IMPORTANCE_HIGH);
        Uri tone = toneUri(prefs.notificationTone(), RingtoneManager.TYPE_NOTIFICATION);
        channel.setSound(tone, new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
        channel.enableVibration(prefs.vibrate());
        if (prefs.vibrate()) channel.setVibrationPattern(VIBRATION);
        manager.createNotificationChannel(channel);
        return id;
    }

    /** The ringing service plays its own sound, so this channel is silent. */
    static void ensureAlarmChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ALARM,
                context.getString(R.string.channel_alarm), NotificationManager.IMPORTANCE_HIGH);
        channel.setSound(null, null);
        channel.enableVibration(false);
        manager(context).createNotificationChannel(channel);
    }

    static NotificationManager manager(Context context) {
        return (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    }
}
