package com.sara.dailywisdom;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

/** Full-screen alarm page, shown over the lock screen while the tone rings. */
public class AlarmActivity extends Activity {
    static final String EXTRA_QUOTE = "quote";

    private final BroadcastReceiver finished = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) { finish(); }
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(R.layout.activity_alarm);

        Quotes.Quote quote = Quotes.all(this).get(getIntent().getIntExtra(EXTRA_QUOTE, 0));
        ((TextView) findViewById(R.id.quote_text)).setText(quote.text);
        ((TextView) findViewById(R.id.quote_meaning)).setText(getString(R.string.meaning_label, quote.meaning));
        ((TextView) findViewById(R.id.quote_source)).setText(quote.source());

        findViewById(R.id.stop).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { send(AlarmService.ACTION_STOP); }
        });
        findViewById(R.id.snooze).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { send(AlarmService.ACTION_SNOOZE); }
        });
        registerReceiver(finished, new IntentFilter(AlarmService.BROADCAST_FINISHED));
    }

    private void send(String action) {
        startService(AlarmService.command(this, action));
        finish();
    }

    @Override
    protected void onDestroy() {
        unregisterReceiver(finished);
        super.onDestroy();
    }
}
