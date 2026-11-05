package com.sara.dailywisdom;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.text.format.DateFormat;
import android.text.format.DateUtils;
import android.view.View;
import android.widget.TextView;

import java.util.Date;

/** Home screen: shows one quote. */
public class MainActivity extends Activity {
    static final String EXTRA_QUOTE = "quote";
    private static final String STATE_QUOTE = "quote";

    private int current;
    private Prefs prefs;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_main);
        prefs = new Prefs(this);
        Alarms.reschedule(this); // Android forgets alarms if the app was force-stopped.

        if (state != null) {
            current = state.getInt(STATE_QUOTE);
        } else if (getIntent().hasExtra(EXTRA_QUOTE)) {
            current = getIntent().getIntExtra(EXTRA_QUOTE, 0);
        } else {
            current = prefs.lastQuote() >= 0 ? prefs.lastQuote() : Quotes.randomOtherThan(this, -1);
        }
        showQuote();

        findViewById(R.id.another).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                current = Quotes.randomOtherThan(MainActivity.this, current);
                showQuote();
            }
        });
        findViewById(R.id.share).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { share(); }
        });
        View.OnClickListener openSettings = new View.OnClickListener() {
            @Override public void onClick(View v) {
                startActivity(new Intent(MainActivity.this, SettingsActivity.class));
            }
        };
        findViewById(R.id.settings).setOnClickListener(openSettings);
        findViewById(R.id.status).setOnClickListener(openSettings);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent.hasExtra(EXTRA_QUOTE)) {
            current = intent.getIntExtra(EXTRA_QUOTE, 0);
            showQuote();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        TextView status = (TextView) findViewById(R.id.status);
        long next = prefs.nextFire();
        if (prefs.enabled() && next > 0) {
            status.setText(getString(R.string.status_next, formatTime(next)));
        } else {
            status.setText(R.string.status_off);
        }
    }

    private String formatTime(long at) {
        String time = DateFormat.getTimeFormat(this).format(new Date(at));
        return DateUtils.isToday(at) ? time : getString(R.string.tomorrow_at, time);
    }

    private void showQuote() {
        Quotes.Quote quote = Quotes.all(this).get(current);
        ((TextView) findViewById(R.id.quote_text)).setText(quote.text);
        ((TextView) findViewById(R.id.quote_meaning)).setText(getString(R.string.meaning_label, quote.meaning));
        ((TextView) findViewById(R.id.quote_source)).setText(quote.source());
    }

    private void share() {
        Quotes.Quote quote = Quotes.all(this).get(current);
        Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain")
                .putExtra(Intent.EXTRA_TEXT, quote.text + "\n\n— " + quote.source());
        startActivity(Intent.createChooser(send, getString(R.string.share)));
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putInt(STATE_QUOTE, current);
    }
}
