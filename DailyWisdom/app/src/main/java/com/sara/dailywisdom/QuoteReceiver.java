package com.sara.dailywisdom;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Wakes up when a quote is due, and after a reboot or clock change to re-book the next one. */
public class QuoteReceiver extends BroadcastReceiver {
    static final String ACTION_FIRE = "com.sara.dailywisdom.FIRE";
    static final String EXTRA_SNOOZE = "snooze";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_FIRE.equals(intent.getAction())) {
            Alarms.reschedule(context);
            return;
        }
        Prefs prefs = new Prefs(context);
        boolean snoozed = intent.getBooleanExtra(EXTRA_SNOOZE, false);
        if (!prefs.enabled()) return;

        if (snoozed) {
            Notifier.deliver(context, Math.max(prefs.lastQuote(), 0), Prefs.STYLE_ALARM);
        } else {
            Notifier.deliver(context, Quotes.nextForReminder(context), prefs.style());
            Alarms.reschedule(context);
        }
    }
}
