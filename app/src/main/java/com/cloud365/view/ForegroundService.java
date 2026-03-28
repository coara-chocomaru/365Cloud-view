package com.cloud365.view;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
public class ForegroundService extends Service {
    public static final String ACTION_START_FOREGROUND = "com.cloud365.view.action.START_FOREGROUND";
    public static final String ACTION_STOP_FOREGROUND = "com.cloud365.view.action.STOP_FOREGROUND";
    public static final String ACTION_STORAGE_UPDATE = "com.cloud365.view.action.STORAGE_UPDATE";
    public static final String ACTION_UPLOAD_STARTED = "com.cloud365.view.action.UPLOAD_STARTED";
    public static final String ACTION_UPLOAD_PROGRESS = "com.cloud365.view.action.UPLOAD_PROGRESS";
    public static final String ACTION_UPLOAD_COMPLETED = "com.cloud365.view.action.UPLOAD_COMPLETED";
    private static final int NOTIFICATION_ID = 4201;
    private static final String CHANNEL_ID = "cloud365_service_channel";
    private static final String CHANNEL_NAME = "365Cloud Service";
    private static final String PROGRESS_CHANNEL_PREFIX = "cloud365_progress_channel_";
    private String storageInfo = "使用容量: -- / --";
    private String lastUpload = "";
    private int uploadPercent = -1;
    private boolean running = false;
    private final Map<String, Integer> uploadFileToNotifId = new HashMap<>();
    private final Map<Integer, Runnable> notifIdToTimeout = new HashMap<>();
    private final AtomicInteger nextNotifId = new AtomicInteger(5000);
    private final Map<Integer, String> notifIdToChannel = new HashMap<>();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private static final long STALE_TIMEOUT_MS = 120000;
    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (action == null) return;
            if (ACTION_STORAGE_UPDATE.equals(action)) {
                String s = intent.getStringExtra("storageInfo");
                if (s != null) {
                    storageInfo = s;
                    updateNotification();
                }
            } else if (ACTION_UPLOAD_STARTED.equals(action)) {
                String files = intent.getStringExtra("files");
                String fileKey = files != null ? files : ("upload_" + System.currentTimeMillis());
                if (fileKey.startsWith("[")) {
                    int idx = fileKey.indexOf('"');
                    if (idx >= 0) {
                        int idx2 = fileKey.indexOf('"', idx + 1);
                        if (idx2 > idx) fileKey = fileKey.substring(idx + 1, idx2);
                    }
                }
                int notifId = createAndShowProgressNotification(fileKey, true);
                uploadFileToNotifId.put(fileKey, notifId);
                uploadPercent = 0;
                lastUpload = fileKey;
                scheduleStaleTimeout(notifId, fileKey, true);
            } else if (ACTION_UPLOAD_PROGRESS.equals(action)) {
                String key = intent.getStringExtra("key");
                int percent = intent.getIntExtra("percent", -1);
                String matchKey = findUploadKeyMatching(key);
                if (matchKey == null) matchKey = key;
                Integer notifId = uploadFileToNotifId.get(matchKey);
                if (notifId == null) {
                    notifId = createAndShowProgressNotification(matchKey, true);
                    uploadFileToNotifId.put(matchKey, notifId);
                    scheduleStaleTimeout(notifId, matchKey, true);
                } else {
                    refreshStaleTimeout(notifId);
                }
                updateProgressNotificationById(notifId, matchKey, percent);
                uploadPercent = percent;
                lastUpload = matchKey;
            } else if (ACTION_UPLOAD_COMPLETED.equals(action)) {
                String key = intent.getStringExtra("key");
                String matchKey = findUploadKeyMatching(key);
                if (matchKey == null) matchKey = key;
                Integer notifId = uploadFileToNotifId.get(matchKey);
                if (notifId != null) {
                    completeProgressNotificationById(notifId, matchKey, true);
                    uploadFileToNotifId.remove(matchKey);
                } else {
                    int nid = createAndShowProgressNotification(matchKey, true);
                    completeProgressNotificationById(nid, matchKey, true);
                }
                uploadPercent = -1;
                lastUpload = matchKey != null ? matchKey : "";
            } else if (ACTION_STOP_FOREGROUND.equals(action)) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    stopForeground(Service.STOP_FOREGROUND_REMOVE);
                } else {
                    stopForeground(true);
                }
                stopSelf();
            }
        }
    };
    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_STORAGE_UPDATE);
        filter.addAction(ACTION_UPLOAD_STARTED);
        filter.addAction(ACTION_UPLOAD_PROGRESS);
        filter.addAction(ACTION_UPLOAD_COMPLETED);
        filter.addAction(ACTION_STOP_FOREGROUND);
        registerReceiver(receiver, filter);
    }
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = CHANNEL_NAME;
            String description = "365Cloud foreground service";
            int importance = NotificationManager.IMPORTANCE_LOW;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }
    private void createProgressChannel(String channelId, String channelName) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;
            NotificationChannel channel = new NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("進行状況通知");
            channel.setShowBadge(false);
            nm.createNotificationChannel(channel);
        }
    }
    private int createAndShowProgressNotification(String fileNameRaw, boolean isUpload) {
        String fileKey = fileNameRaw != null ? fileNameRaw : "unknown_" + System.currentTimeMillis();
        String channelId = PROGRESS_CHANNEL_PREFIX + Math.abs(fileKey.hashCode()) + "_" + System.currentTimeMillis();
        createProgressChannel(channelId, isUpload ? "アップロード進行状況" : "進行状況");
        int notifId = nextNotifId.getAndIncrement();
        notifIdToChannel.put(notifId, channelId);
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            pendingIntent = PendingIntent.getActivity(this, notifId, intent, PendingIntent.FLAG_IMMUTABLE);
        } else {
            pendingIntent = PendingIntent.getActivity(this, notifId, intent, 0);
        }
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setContentTitle(isUpload ? "アップロード中" : "進行中")
                .setContentText(fileKey)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentIntent(pendingIntent)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setProgress(100, 0, false);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(notifId, builder.build());
        return notifId;
    }
    private void updateProgressNotificationById(int notifId, String fileKey, int percent) {
        String channelId = notifIdToChannel.containsKey(notifId) ? notifIdToChannel.get(notifId) : CHANNEL_ID;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("進行中")
                .setContentText(fileKey)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        int p = percent;
        if (p < 0) p = 0;
        if (p > 100) p = 100;
        builder.setProgress(100, p, false);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(notifId, builder.build());
    }
    private void completeProgressNotificationById(int notifId, String fileKey, boolean isUpload) {
        String channelId = notifIdToChannel.containsKey(notifId) ? notifIdToChannel.get(notifId) : CHANNEL_ID;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setContentTitle(isUpload ? "アップロード完了" : "完了")
                .setContentText(fileKey)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setOnlyAlertOnce(true)
                .setAutoCancel(true)
                .setOngoing(false)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setStyle(new NotificationCompat.BigTextStyle().bigText((isUpload ? "アップロードが完了しました: " : "完了: ") + fileKey));
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(notifId, builder.build());
        cancelStaleTimeout(notifId);
    }
    private String findUploadKeyMatching(String shortName) {
        if (shortName == null) return null;
        if (uploadFileToNotifId.containsKey(shortName)) return shortName;
        for (String k : uploadFileToNotifId.keySet()) {
            if (k != null && k.contains(shortName)) return k;
        }
        return null;
    }
    private void scheduleStaleTimeout(int notifId, String key, boolean isUpload) {
        Runnable r = new Runnable() {
            @Override
            public void run() {
                try {
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null) nm.cancel(notifId);
                    notifIdToTimeout.remove(notifId);
                    if (isUpload) {
                        String removeKey = null;
                        for (Map.Entry<String,Integer> e : uploadFileToNotifId.entrySet()) {
                            if (e.getValue().equals(notifId)) { removeKey = e.getKey(); break; }
                        }
                        if (removeKey != null) uploadFileToNotifId.remove(removeKey);
                    }
                } catch (Exception e) {}
            }
        };
        handler.postDelayed(r, STALE_TIMEOUT_MS);
        notifIdToTimeout.put(notifId, r);
    }
    private void refreshStaleTimeout(int notifId) {
        Runnable r = notifIdToTimeout.get(notifId);
        if (r != null) {
            handler.removeCallbacks(r);
            handler.postDelayed(r, STALE_TIMEOUT_MS);
        }
    }
    private void cancelStaleTimeout(int notifId) {
        Runnable r = notifIdToTimeout.get(notifId);
        if (r != null) {
            handler.removeCallbacks(r);
            notifIdToTimeout.remove(notifId);
        }
    }
    private void updateNotification() {
        String content = storageInfo;
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);
        } else {
            pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, 0);
        }
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("365Cloud")
                .setContentText(content)
                .setSmallIcon(android.R.drawable.ic_menu_save)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW);
        Notification notification = builder.build();
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, notification);
        }
        if (!running) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForeground(NOTIFICATION_ID, notification);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            running = true;
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                startForeground(NOTIFICATION_ID, notification);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        }
    }
    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_START_FOREGROUND.equals(intent.getAction())) {
            updateNotification();
        }
        return START_NOT_STICKY;
    }
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }
    @Override
    public void onDestroy() {
        try { unregisterReceiver(receiver); } catch (Exception e) {}
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancelAll();
        }
        super.onDestroy();
    }
}
