import java.io.*; import java.nio.file.*; import java.util.*; import java.util.zip.*;
import org.objectweb.asm.*;
/** Adds the few newer Android signatures this app uses to the API 23 android.jar. Compile-time only. */
public class PatchJar {
    static byte[] patch(byte[] in, String name) {
        ClassReader r = new ClassReader(in); ClassWriter w = new ClassWriter(0);
        r.accept(w, 0);
        switch (name) {
            case "android/content/Context": m(w,"startForegroundService","(Landroid/content/Intent;)Landroid/content/ComponentName;"); break;
            case "android/app/AlarmManager": m(w,"canScheduleExactAlarms","()Z"); break;
            case "android/app/NotificationManager":
                m(w,"canUseFullScreenIntent","()Z");
                m(w,"getNotificationChannels","()Ljava/util/List;","()Ljava/util/List<Landroid/app/NotificationChannel;>;");
                m(w,"createNotificationChannel","(Landroid/app/NotificationChannel;)V");
                m(w,"deleteNotificationChannel","(Ljava/lang/String;)V");
                w.visitField(Opcodes.ACC_PUBLIC|Opcodes.ACC_STATIC|Opcodes.ACC_FINAL,"IMPORTANCE_HIGH","I",null,4).visitEnd();
                break;
            case "android/app/Notification$Builder":
                MethodVisitor c=w.visitMethod(Opcodes.ACC_PUBLIC,"<init>","(Landroid/content/Context;Ljava/lang/String;)V",null,null);
                c.visitCode(); c.visitInsn(Opcodes.RETURN); c.visitMaxs(0,3); c.visitEnd(); break;
            default:
        }
        return w.toByteArray();
    }
    static void m(ClassWriter w,String n,String d){m(w,n,d,null);}
    static void m(ClassWriter w,String n,String d,String sig){
        MethodVisitor v=w.visitMethod(Opcodes.ACC_PUBLIC,n,d,sig,null);
        v.visitCode(); v.visitInsn(Opcodes.RETURN); v.visitMaxs(0,4); v.visitEnd();
    }
    public static void main(String[] a) throws Exception {
        Set<String> t=new HashSet<>(Arrays.asList("android/content/Context","android/app/AlarmManager","android/app/NotificationManager","android/app/Notification$Builder"));
        try(ZipFile in=new ZipFile(a[0]); ZipOutputStream out=new ZipOutputStream(new FileOutputStream(a[1]))){
            for(Enumeration<? extends ZipEntry> e=in.entries();e.hasMoreElements();){
                ZipEntry z=e.nextElement(); if(z.isDirectory())continue;
                byte[] b=in.getInputStream(z).readAllBytes(); String n=z.getName();
                if(n.endsWith(".class")&&t.contains(n.substring(0,n.length()-6))) b=patch(b,n.substring(0,n.length()-6));
                out.putNextEntry(new ZipEntry(n)); out.write(b); out.closeEntry();
            }
        }
    }
}
