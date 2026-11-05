package com.sara.dailywisdom;

import android.app.Activity;
import android.app.TimePickerDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.format.DateFormat;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.CompoundButton;
import android.widget.LinearLayout;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.TimePicker;
import android.widget.Toast;

import java.util.Arrays;
import java.util.Calendar;
import java.util.Date;

/** Reminder schedule, style, tones and the on/off switch. */
public class SettingsActivity extends Activity {
    private static final String PERMISSION_NOTIFY = "android.permission.POST_NOTIFICATIONS";
    private static final int REQUEST_PERMISSION = 1;
    private static final int REQUEST_TONE = 2;
    private static final int REQUEST_ALARM_TONE = 3;
    private static final int[] INTERVALS = {30, 60, 120, 180, 240, 360, 480, 720};

    private interface TimeChosen { void onTime(int minute); }

    private Prefs prefs;
    private Switch enabled;
    private TextView nextText;
    private TextView onceTime;
    private TextView startTime;
    private TextView endTime;
    private TextView toneName;
    private TextView alarmToneName;
    private LinearLayout timesList;
    private View onceGroup;
    private View customGroup;
    private View intervalGroup;
    private View fullScreenRow;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_settings);
        prefs = new Prefs(this);
        bindViews();
        bindMasterSwitch();
        bindSchedule();
        bindStyleAndTones();
        refresh();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refresh();
    }

    private void bindViews() {
        enabled = (Switch) findViewById(R.id.enabled);
        nextText = (TextView) findViewById(R.id.next);
        onceTime = (TextView) findViewById(R.id.once_time);
        startTime = (TextView) findViewById(R.id.start_time);
        endTime = (TextView) findViewById(R.id.end_time);
        toneName = (TextView) findViewById(R.id.tone_name);
        alarmToneName = (TextView) findViewById(R.id.alarm_tone_name);
        timesList = (LinearLayout) findViewById(R.id.times_list);
        onceGroup = findViewById(R.id.once_group);
        customGroup = findViewById(R.id.custom_group);
        intervalGroup = findViewById(R.id.interval_group);
        fullScreenRow = findViewById(R.id.full_screen_row);
    }

    private void bindMasterSwitch() {
        enabled.setChecked(prefs.enabled());
        enabled.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override public void onCheckedChanged(CompoundButton b, boolean on) {
                prefs.setEnabled(on);
                if (on) askForNotifications();
                changed();
            }
        });
    }

    private void bindSchedule() {
        RadioGroup mode = (RadioGroup) findViewById(R.id.mode);
        mode.check(modeButton(prefs.mode()));
        mode.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override public void onCheckedChanged(RadioGroup g, int id) {
                prefs.setMode(id == R.id.mode_once ? Schedule.MODE_ONCE_A_DAY
                        : id == R.id.mode_custom ? Schedule.MODE_CUSTOM_TIMES : Schedule.MODE_INTERVAL);
                changed();
            }
        });

        onceTime.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                pickTime(prefs.onceMinute(), new TimeChosen() {
                    @Override public void onTime(int m) { prefs.setOnceMinute(m); changed(); }
                });
            }
        });
        startTime.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                pickTime(prefs.startMinute(), new TimeChosen() {
                    @Override public void onTime(int m) { prefs.setStartMinute(m); changed(); }
                });
            }
        });
        endTime.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                pickTime(prefs.endMinute(), new TimeChosen() {
                    @Override public void onTime(int m) { prefs.setEndMinute(m); changed(); }
                });
            }
        });
        findViewById(R.id.add_time).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                pickTime(12 * 60, new TimeChosen() {
                    @Override public void onTime(int m) { addTime(m); }
                });
            }
        });

        Spinner interval = (Spinner) findViewById(R.id.interval);
        String[] labels = new String[INTERVALS.length];
        int selected = 2;
        for (int i = 0; i < INTERVALS.length; i++) {
            labels[i] = intervalLabel(INTERVALS[i]);
            if (INTERVALS[i] == prefs.intervalMinutes()) selected = i;
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, labels);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        interval.setAdapter(adapter);
        interval.setSelection(selected);
        interval.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> p, View v, int position, long id) {
                if (prefs.intervalMinutes() != INTERVALS[position]) {
                    prefs.setIntervalMinutes(INTERVALS[position]);
                    changed();
                }
            }
            @Override public void onNothingSelected(AdapterView<?> p) { }
        });
    }

    private void bindStyleAndTones() {
        RadioGroup style = (RadioGroup) findViewById(R.id.style);
        style.check(prefs.style() == Prefs.STYLE_ALARM ? R.id.style_alarm : R.id.style_notification);
        style.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override public void onCheckedChanged(RadioGroup g, int id) {
                prefs.setStyle(id == R.id.style_alarm ? Prefs.STYLE_ALARM : Prefs.STYLE_NOTIFICATION);
                changed();
            }
        });

        findViewById(R.id.tone_row).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                pickTone(RingtoneManager.TYPE_NOTIFICATION, prefs.notificationTone(), REQUEST_TONE);
            }
        });
        findViewById(R.id.alarm_tone_row).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                pickTone(RingtoneManager.TYPE_ALARM, prefs.alarmTone(), REQUEST_ALARM_TONE);
            }
        });

        Switch vibrate = (Switch) findViewById(R.id.vibrate);
        vibrate.setChecked(prefs.vibrate());
        vibrate.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override public void onCheckedChanged(CompoundButton b, boolean on) { prefs.setVibrate(on); }
        });

        findViewById(R.id.test).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                askForNotifications();
                Notifier.deliver(SettingsActivity.this, Quotes.nextForReminder(SettingsActivity.this), prefs.style());
            }
        });
        findViewById(R.id.battery).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
            }
        });
        fullScreenRow.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                startActivity(new Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT",
                        Uri.parse("package:" + getPackageName())));
            }
        });
    }

    private int modeButton(int mode) {
        if (mode == Schedule.MODE_ONCE_A_DAY) return R.id.mode_once;
        return mode == Schedule.MODE_CUSTOM_TIMES ? R.id.mode_custom : R.id.mode_interval;
    }

    private void addTime(int minute) {
        int[] times = prefs.customTimes();
        for (int t : times) if (t == minute) return;
        int[] grown = Arrays.copyOf(times, times.length + 1);
        grown[times.length] = minute;
        prefs.setCustomTimes(grown);
        changed();
    }

    private void removeTime(int minute) {
        int[] times = prefs.customTimes();
        int[] left = new int[times.length - 1];
        int n = 0;
        for (int t : times) if (t != minute) left[n++] = t;
        prefs.setCustomTimes(left);
        changed();
    }

    private void changed() {
        Alarms.reschedule(this);
        refresh();
    }

    private void refresh() {
        boolean blocked = Build.VERSION.SDK_INT >= 34
                && !Notifier.manager(this).canUseFullScreenIntent();
        fullScreenRow.setVisibility(blocked && prefs.style() == Prefs.STYLE_ALARM ? View.VISIBLE : View.GONE);
        int mode = prefs.mode();
        onceGroup.setVisibility(mode == Schedule.MODE_ONCE_A_DAY ? View.VISIBLE : View.GONE);
        customGroup.setVisibility(mode == Schedule.MODE_CUSTOM_TIMES ? View.VISIBLE : View.GONE);
        intervalGroup.setVisibility(mode == Schedule.MODE_INTERVAL ? View.VISIBLE : View.GONE);
        onceTime.setText(clock(prefs.onceMinute()));
        startTime.setText(clock(prefs.startMinute()));
        endTime.setText(clock(prefs.endMinute()));
        toneName.setText(toneTitle(prefs.notificationTone()));
        alarmToneName.setText(toneTitle(prefs.alarmTone()));

        timesList.removeAllViews();
        LayoutInflater inflater = LayoutInflater.from(this);
        for (final int minute : prefs.customTimes()) {
            View row = inflater.inflate(R.layout.item_time, timesList, false);
            ((TextView) row.findViewById(R.id.time)).setText(clock(minute));
            row.findViewById(R.id.remove).setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { removeTime(minute); }
            });
            timesList.addView(row);
        }

        long next = prefs.nextFire();
        if (!prefs.enabled()) nextText.setText(R.string.status_off);
        else if (next < 0) nextText.setText(R.string.status_no_times);
        else nextText.setText(getString(R.string.status_next, dateTime(next)));
    }

    private String dateTime(long at) {
        Date d = new Date(at);
        return DateFormat.getMediumDateFormat(this).format(d) + ", " + DateFormat.getTimeFormat(this).format(d);
    }

    private String clock(int minute) {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, minute / 60);
        c.set(Calendar.MINUTE, minute % 60);
        return DateFormat.getTimeFormat(this).format(c.getTime());
    }

    private String intervalLabel(int minutes) {
        if (minutes < 60) return getString(R.string.every_minutes, minutes);
        if (minutes == 60) return getString(R.string.every_hour);
        return getString(R.string.every_hours, minutes / 60);
    }

    private String toneTitle(String saved) {
        if (saved == null) return getString(R.string.tone_default);
        if (saved.isEmpty()) return getString(R.string.tone_silent);
        try {
            Ringtone ringtone = RingtoneManager.getRingtone(this, Uri.parse(saved));
            return ringtone == null ? getString(R.string.tone_custom) : ringtone.getTitle(this);
        } catch (RuntimeException unreadable) {
            return getString(R.string.tone_custom);
        }
    }

    private void pickTime(int minute, final TimeChosen done) {
        new TimePickerDialog(this, new TimePickerDialog.OnTimeSetListener() {
            @Override public void onTimeSet(TimePicker view, int hour, int min) { done.onTime(hour * 60 + min); }
        }, minute / 60, minute % 60, DateFormat.is24HourFormat(this)).show();
    }

    private void pickTone(int type, String saved, int request) {
        Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER)
                .putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, type)
                .putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, getString(R.string.choose_tone))
                .putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
                .putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, true)
                .putExtra(RingtoneManager.EXTRA_RINGTONE_DEFAULT_URI, RingtoneManager.getDefaultUri(type));
        if (saved == null) {
            intent.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, RingtoneManager.getDefaultUri(type));
        } else if (!saved.isEmpty()) {
            intent.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(saved));
        }
        startActivityForResult(intent, request);
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (result != RESULT_OK || data == null) return;
        Uri uri = data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
        int type = request == REQUEST_TONE ? RingtoneManager.TYPE_NOTIFICATION : RingtoneManager.TYPE_ALARM;
        String value = uri == null ? ""
                : uri.equals(RingtoneManager.getDefaultUri(type)) ? null : uri.toString();
        if (request == REQUEST_TONE) prefs.setNotificationTone(value);
        else if (request == REQUEST_ALARM_TONE) prefs.setAlarmTone(value);
        refresh();
    }

    private void askForNotifications() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(PERMISSION_NOTIFY) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] {PERMISSION_NOTIFY}, REQUEST_PERMISSION);
        }
    }

    @Override
    public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        if (request == REQUEST_PERMISSION && results.length > 0
                && results[0] != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, R.string.permission_needed, Toast.LENGTH_LONG).show();
        }
    }
}
