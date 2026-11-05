#!/bin/bash
# Builds the APK without Gradle, from Ubuntu's Android packages:
#   apt-get install aapt apksigner dalvik-exchange zipalign android-sdk-platform-23 libandroid-23-java libasm-java
# Android Studio users can ignore this and just open the project.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; B="$ROOT/build"; M="$ROOT/app/src/main"
AJ=/usr/lib/android-sdk/platforms/android-23/android.jar
rm -rf "$B"; mkdir -p "$B"/{gen,obj,dex,stub,patcher}
export JAVA_TOOL_OPTIONS=
javac -nowarn -cp /usr/share/java/asm.jar -d "$B/patcher" "$ROOT/tools/compile-stubs/patcher/PatchJar.java"
java -cp "$B/patcher:/usr/share/java/asm.jar" PatchJar "$AJ" "$B/android-patched.jar"
javac -nowarn -source 8 -target 8 -bootclasspath "$B/android-patched.jar" -d "$B/stub" "$ROOT/tools/compile-stubs/android/app/NotificationChannel.java" 2>/dev/null
(cd "$B/stub" && jar uf "$B/android-patched.jar" android)
sed 's|<manifest xmlns:android="http://schemas.android.com/apk/res/android">|<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.sara.dailywisdom">|' "$M/AndroidManifest.xml" > "$B/AndroidManifest.xml"
aapt2 compile --dir "$M/res" -o "$B/res.zip"
aapt2 link -o "$B/base.apk" -I "$AJ" --manifest "$B/AndroidManifest.xml" --java "$B/gen" \
  --min-sdk-version 24 --target-sdk-version 33 --version-code 2 --version-name 1.1 --auto-add-overlay \
  -A "$M/assets" "$B/res.zip"
javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$B/android-patched.jar" -d "$B/obj" \
  $(find "$M/java" "$B/gen" -name '*.java')
dalvik-exchange --dex --min-sdk-version=24 --output="$B/dex/classes.dex" "$B/obj"
cp "$B/base.apk" "$B/unsigned.apk"; (cd "$B/dex" && zip -q -j "$B/unsigned.apk" classes.dex)
zipalign -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"
KS="$ROOT/signing/dailywisdom.jks"
[ -f "$KS" ] || { mkdir -p "$ROOT/signing"; keytool -genkeypair -keystore "$KS" -storepass dailywisdom -keypass dailywisdom \
  -alias dailywisdom -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Daily Wisdom" 2>/dev/null; }
apksigner sign --ks "$KS" --ks-pass pass:dailywisdom --key-pass pass:dailywisdom --v1-signing-enabled false --v2-signing-enabled true --out "$ROOT/DailyWisdom.apk" "$B/aligned.apk"
echo "Built $ROOT/DailyWisdom.apk"
