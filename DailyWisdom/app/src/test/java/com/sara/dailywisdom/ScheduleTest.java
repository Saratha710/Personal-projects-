package com.sara.dailywisdom;

import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.TimeZone;

/** Run with: java ScheduleTest (no phone needed). */
public class ScheduleTest {
    static final TimeZone IST = TimeZone.getTimeZone("Asia/Kolkata");
    static int failures = 0;

    static long at(String s, TimeZone z) throws Exception {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd HH:mm");
        f.setTimeZone(z);
        return f.parse(s).getTime();
    }

    static void check(String name, String now, TimeZone z, List<Integer> minutes, String want) throws Exception {
        long got = Schedule.next(at(now, z), z, minutes);
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd HH:mm");
        f.setTimeZone(z);
        String gotText = got < 0 ? "none" : f.format(new Date(got));
        boolean ok = gotText.equals(want);
        if (!ok) failures++;
        System.out.println((ok ? "ok   " : "FAIL ") + name + " -> " + gotText + (ok ? "" : " wanted " + want));
    }

    static List<Integer> interval(int every, int start, int end) {
        return Schedule.firingMinutes(Schedule.MODE_INTERVAL, 0, new int[0], every, start, end);
    }

    public static void main(String[] a) throws Exception {
        List<Integer> once = Schedule.firingMinutes(Schedule.MODE_ONCE_A_DAY, 480, new int[0], 0, 0, 0);
        check("once, before time", "2026-11-04 07:00", IST, once, "2026-11-04 08:00");
        check("once, exactly at time rolls to tomorrow", "2026-11-04 08:00", IST, once, "2026-11-05 08:00");
        check("once, month end", "2026-11-30 09:00", IST, once, "2026-12-01 08:00");
        List<Integer> custom = Schedule.firingMinutes(Schedule.MODE_CUSTOM_TIMES, 0, new int[] {480, 780, 1200}, 0, 0, 0);
        check("custom, picks middle", "2026-11-04 09:00", IST, custom, "2026-11-04 13:00");
        check("custom, after last", "2026-11-04 21:00", IST, custom, "2026-11-05 08:00");
        check("custom, empty", "2026-11-04 21:00", IST,
                Schedule.firingMinutes(Schedule.MODE_CUSTOM_TIMES, 0, new int[0], 0, 0, 0), "none");
        List<Integer> two = interval(120, 480, 1320);
        check("2h, next slot", "2026-11-04 09:10", IST, two, "2026-11-04 10:00");
        check("2h, last slot is end time", "2026-11-04 21:00", IST, two, "2026-11-04 22:00");
        check("2h, quiet at night", "2026-11-04 22:30", IST, two, "2026-11-05 08:00");
        check("2h, before window", "2026-11-04 03:00", IST, two, "2026-11-04 08:00");
        List<Integer> night = interval(120, 1320, 120);
        check("overnight window, after midnight", "2026-11-05 00:30", IST, night, "2026-11-05 02:00");
        check("overnight window, finished", "2026-11-05 03:00", IST, night, "2026-11-05 22:00");
        check("all day, start equals end", "2026-11-04 23:30", IST, interval(120, 0, 0), "2026-11-05 00:00");
        check("every 30 min", "2026-11-04 08:10", IST, interval(30, 480, 1320), "2026-11-04 08:30");
        TimeZone ny = TimeZone.getTimeZone("America/New_York");
        check("daylight saving change day", "2026-03-08 00:30", ny, once, "2026-03-08 08:00");
        System.out.println(failures == 0 ? "ALL PASSED" : failures + " FAILED");
        System.exit(failures == 0 ? 0 : 1);
    }
}
