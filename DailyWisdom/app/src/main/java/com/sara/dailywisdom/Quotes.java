package com.sara.dailywisdom;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/** The built-in quote library (assets/quotes.json). Nothing here uses the internet. */
final class Quotes {
    static final class Quote {
        final String text;
        final String author;
        final String work;
        final String meaning;

        Quote(String text, String author, String work, String meaning) {
            this.text = text;
            this.author = author;
            this.work = work;
            this.meaning = meaning;
        }

        String source() { return author + ", " + work; }

        /** Quote with its meaning underneath, for the expanded notification. */
        String withMeaning(Context context) {
            return text + "\n\n" + context.getString(R.string.meaning_label, meaning);
        }
    }

    private static List<Quote> cache;
    private static final Random RANDOM = new Random();

    private Quotes() {}

    static synchronized List<Quote> all(Context context) {
        if (cache != null) return cache;
        try (InputStream in = context.getAssets().open("quotes.json")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) > 0) bytes.write(buffer, 0, n);
            JSONArray array = new JSONArray(bytes.toString("UTF-8"));
            List<Quote> out = new ArrayList<Quote>(array.length());
            for (int i = 0; i < array.length(); i++) {
                JSONObject o = array.getJSONObject(i);
                out.add(new Quote(o.getString("text"), o.getString("author"), o.getString("work"),
                        o.getString("meaning")));
            }
            cache = out;
            return out;
        } catch (IOException | JSONException e) {
            throw new IllegalStateException("Quote library is damaged", e);
        }
    }

    /** Next quote for a reminder: goes through the whole library in random order before repeating. */
    static synchronized int nextForReminder(Context context) {
        Prefs prefs = new Prefs(context);
        int size = all(context).size();
        List<Integer> order = prefs.shuffleOrder();
        if (order.isEmpty()) {
            for (int i = 0; i < size; i++) order.add(i);
            Collections.shuffle(order, RANDOM);
        }
        int index = order.remove(order.size() - 1);
        if (index >= size) index = RANDOM.nextInt(size);
        prefs.setShuffleOrder(order);
        prefs.setLastQuote(index);
        return index;
    }

    static int randomOtherThan(Context context, int current) {
        int size = all(context).size();
        int index = RANDOM.nextInt(size);
        return index == current ? (index + 1) % size : index;
    }
}
