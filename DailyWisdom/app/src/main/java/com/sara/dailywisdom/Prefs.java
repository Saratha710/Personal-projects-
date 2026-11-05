package com.sara.dailywisdom;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** All user settings, stored on the phone only. */
final class Prefs {
    static final int STYLE_NOTIFICATION = 0;
    static final int STYLE_ALARM = 1;

    private static final String NAME = "settings";
    private final SharedPreferences p;

    Prefs(Context context) {
        p = context.getApplicationContext().getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    boolean enabled() { return p.getBoolean("enabled", false); }
    void setEnabled(boolean v) { p.edit().putBoolean("enabled", v).apply(); }

    int mode() { return p.getInt("mode", Schedule.MODE_INTERVAL); }
    void setMode(int v) { p.edit().putInt("mode", v).apply(); }

    int onceMinute() { return p.getInt("once", 8 * 60); }
    void setOnceMinute(int v) { p.edit().putInt("once", v).apply(); }

    int intervalMinutes() { return p.getInt("interval", 120); }
    void setIntervalMinutes(int v) { p.edit().putInt("interval", v).apply(); }

    int startMinute() { return p.getInt("start", 8 * 60); }
    void setStartMinute(int v) { p.edit().putInt("start", v).apply(); }

    int endMinute() { return p.getInt("end", 22 * 60); }
    void setEndMinute(int v) { p.edit().putInt("end", v).apply(); }

    int[] customTimes() {
        String raw = p.getString("times", "480,780,1200");
        if (raw.isEmpty()) return new int[0];
        String[] parts = raw.split(",");
        int[] out = new int[parts.length];
        for (int i = 0; i < parts.length; i++) out[i] = Integer.parseInt(parts[i]);
        Arrays.sort(out);
        return out;
    }

    void setCustomTimes(int[] times) {
        StringBuilder b = new StringBuilder();
        for (int t : times) {
            if (b.length() > 0) b.append(',');
            b.append(t);
        }
        p.edit().putString("times", b.toString()).apply();
    }

    int style() { return p.getInt("style", STYLE_NOTIFICATION); }
    void setStyle(int v) { p.edit().putInt("style", v).apply(); }

    boolean vibrate() { return p.getBoolean("vibrate", true); }
    void setVibrate(boolean v) { p.edit().putBoolean("vibrate", v).apply(); bumpChannel(); }

    /** null = phone default, "" = silent, otherwise a content:// tone. */
    String notificationTone() { return p.getString("tone", null); }
    void setNotificationTone(String v) { p.edit().putString("tone", v).apply(); bumpChannel(); }

    String alarmTone() { return p.getString("alarmTone", null); }
    void setAlarmTone(String v) { p.edit().putString("alarmTone", v).apply(); }

    /** Android freezes a channel's sound once created, so a new tone needs a new channel. */
    int channelVersion() { return p.getInt("channel", 1); }
    private void bumpChannel() { p.edit().putInt("channel", channelVersion() + 1).apply(); }

    int lastQuote() { return p.getInt("last", -1); }
    void setLastQuote(int v) { p.edit().putInt("last", v).apply(); }

    long nextFire() { return p.getLong("nextFire", -1); }
    void setNextFire(long v) { p.edit().putLong("nextFire", v).apply(); }

    List<Integer> shuffleOrder() {
        String raw = p.getString("order", "");
        List<Integer> out = new ArrayList<Integer>();
        if (!raw.isEmpty()) for (String s : raw.split(",")) out.add(Integer.parseInt(s));
        return out;
    }

    void setShuffleOrder(List<Integer> order) {
        StringBuilder b = new StringBuilder();
        for (int i : order) {
            if (b.length() > 0) b.append(',');
            b.append(i);
        }
        p.edit().putString("order", b.toString()).apply();
    }

    List<Integer> firingMinutes() {
        return Schedule.firingMinutes(mode(), onceMinute(), customTimes(),
                intervalMinutes(), startMinute(), endMinute());
    }
}
