package com.sara.dailywisdom;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import java.util.List;
import java.util.TimeZone;

/** Talks to Android's AlarmManager. Only the next firing is ever booked; each firing books the one after. */
final class Alarms {
    private static final int REQUEST_NEXT = 1;
    private static final int REQUEST_SNOOZE = 2;
    private static final int SNOOZE_MINUTES = 10;

    private Alarms() {}

    static void reschedule(Context context) {
        Prefs prefs = new Prefs(context);
        cancelNext(context);
        List<Integer> minutes = prefs.firingMinutes();
        long next = prefs.enabled()
                ? Schedule.next(System.currentTimeMillis(), TimeZone.getDefault(), minutes) : -1;
        prefs.setNextFire(next);
        if (next < 0) {
            cancelSnooze(context);
            return;
        }
        book(context, next, firePendingIntent(context, REQUEST_NEXT, false), prefs.style() == Prefs.STYLE_ALARM);
    }

    static void snooze(Context context) {
        long at = System.currentTimeMillis() + SNOOZE_MINUTES * 60_000L;
        book(context, at, firePendingIntent(context, REQUEST_SNOOZE, true), true);
    }

    private static void book(Context context, long at, PendingIntent fire, boolean alarmClock) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        boolean exactAllowed = Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms();
        if (!exactAllowed) {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
        } else if (alarmClock) {
            PendingIntent show = PendingIntent.getActivity(context, 0,
                    new Intent(context, SettingsActivity.class),
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            manager.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), fire);
        } else {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
        }
    }

    private static void cancelNext(Context context) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        manager.cancel(firePendingIntent(context, REQUEST_NEXT, false));
    }

    private static void cancelSnooze(Context context) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        manager.cancel(firePendingIntent(context, REQUEST_SNOOZE, true));
    }

    private static PendingIntent firePendingIntent(Context context, int request, boolean snooze) {
        Intent intent = new Intent(context, QuoteReceiver.class)
                .setAction(QuoteReceiver.ACTION_FIRE)
                .putExtra(QuoteReceiver.EXTRA_SNOOZE, snooze);
        return PendingIntent.getBroadcast(context, request, intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
