package android.app;
/** Compile-time stand-in only (never packed into the APK); the real class is on the phone. */
public final class NotificationChannel {
    public NotificationChannel(String id, CharSequence name, int importance) { }
    public String getId() { return null; }
    public void setSound(android.net.Uri sound, android.media.AudioAttributes a) { }
    public void enableVibration(boolean v) { }
    public void setVibrationPattern(long[] p) { }
}
