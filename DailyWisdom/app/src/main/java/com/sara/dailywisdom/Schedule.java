package com.sara.dailywisdom;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.TimeZone;

/** Works out when the next quote is due. Plain Java so it can be unit tested without a phone. */
final class Schedule {
    static final int MODE_ONCE_A_DAY = 0;
    static final int MODE_CUSTOM_TIMES = 1;
    static final int MODE_INTERVAL = 2;

    private Schedule() {}

    /** Minutes after midnight for every firing belonging to one "day". May run past 1440 for overnight windows. */
    static List<Integer> firingMinutes(int mode, int onceMinute, int[] customTimes,
                                       int intervalMinutes, int startMinute, int endMinute) {
        List<Integer> out = new ArrayList<Integer>();
        if (mode == MODE_ONCE_A_DAY) {
            out.add(onceMinute);
        } else if (mode == MODE_CUSTOM_TIMES) {
            for (int t : customTimes) out.add(t);
        } else if (intervalMinutes > 0) {
            boolean fullDay = endMinute == startMinute;
            int last = fullDay ? startMinute + 1439 : (endMinute > startMinute ? endMinute : endMinute + 1440);
            for (int m = startMinute; m <= last; m += intervalMinutes) out.add(m);
        }
        return out;
    }

    /** Next firing strictly after {@code now}, or -1 when no time is configured. */
    static long next(long now, TimeZone zone, List<Integer> minutes) {
        long best = -1;
        // Start at yesterday: an overnight window opened yesterday may still be running.
        for (int dayOffset = -1; dayOffset <= 2; dayOffset++) {
            for (int minute : minutes) {
                Calendar c = Calendar.getInstance(zone);
                c.setTimeInMillis(now);
                c.add(Calendar.DAY_OF_YEAR, dayOffset);
                // Clock-time fields keep 08:00 at 08:00 across daylight saving; minute may exceed a day.
                c.set(Calendar.HOUR_OF_DAY, minute / 60);
                c.set(Calendar.MINUTE, minute % 60);
                c.set(Calendar.SECOND, 0);
                c.set(Calendar.MILLISECOND, 0);
                long t = c.getTimeInMillis();
                if (t > now && (best < 0 || t < best)) best = t;
            }
        }
        return best;
    }
}
