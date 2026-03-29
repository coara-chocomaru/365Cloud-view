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
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class ForegroundService extends Service {

    public static final String ACTION_START_FOREGROUND = "com.cloud365.view.action.START_FOREGROUND";
    public static final String ACTION_STOP_FOREGROUND = "com.cloud365.view.action.STOP_FOREGROUND";
    public static final String ACTION_STORAGE_UPDATE = "com.cloud365.view.action.STORAGE_UPDATE";
    public static final String ACTION_UPLOAD_PROGRESS = "com.cloud365.view.action.UPLOAD_PROGRESS";
    public static final String ACTION_UPLOAD_FINISHED = "com.cloud365.view.action.UPLOAD_FINISHED";
    public static final String ACTION_DELETE_COMPLETED = "com.cloud365.view.action.DELETE_COMPLETED";

    private static final int FOREGROUND_NOTIFICATION_ID = 4201;
    private static final int UPLOAD_NOTIFICATION_ID = 4202;

    private static final String FOREGROUND_CHANNEL_ID = "cloud365_foreground_channel";
    private static final String UPLOAD_CHANNEL_ID = "cloud365_upload_channel";

    private String storageInfo = "使用容量: -- / --";
    private String uploadFileName = null;
    private int uploadPercent = 0;
    private long uploadLoaded = 0;
    private long uploadTotal = 0;
    private boolean isUploading = false;
    private boolean running = false;

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (action == null) return;

            if (ACTION_STORAGE_UPDATE.equals(action)) {
                String s = intent.getStringExtra("storageInfo");
                if (s != null) {
                    storageInfo = s;
                    updateForegroundNotification();
                }
            } else if (ACTION_UPLOAD_PROGRESS.equals(action)) {
                uploadFileName = intent.getStringExtra("fileName");
                uploadPercent = intent.getIntExtra("percent", 0);
                uploadLoaded = intent.getLongExtra("loaded", 0);
                uploadTotal = intent.getLongExtra("total", 1);
                isUploading = true;
                updateUploadNotification(false);
            } else if (ACTION_UPLOAD_FINISHED.equals(action)) {
                if (uploadFileName != null) {
                    updateUploadNotification(true);
                }
                isUploading = false;
                uploadFileName = null;
                uploadPercent = 0;
                uploadLoaded = 0;
                uploadTotal = 0;
                String s = intent.getStringExtra("storageInfo");
                if (s != null) {
                    storageInfo = s;
                }
                updateForegroundNotification();
            } else if (ACTION_DELETE_COMPLETED.equals(action)) {
                updateForegroundNotification();
            } else if (ACTION_STOP_FOREGROUND.equals(action)) {
                stopForegroundService();
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();

        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_STORAGE_UPDATE);
        filter.addAction(ACTION_UPLOAD_PROGRESS);
        filter.addAction(ACTION_UPLOAD_FINISHED);
        filter.addAction(ACTION_DELETE_COMPLETED);
        filter.addAction(ACTION_STOP_FOREGROUND);

        registerReceiver(receiver, filter);

        updateForegroundNotification();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);

            NotificationChannel foregroundChannel = new NotificationChannel(
                    FOREGROUND_CHANNEL_ID,
                    "365Cloud 常駐通知",
                    NotificationManager.IMPORTANCE_DEFAULT);
            foregroundChannel.setDescription("ストレージ容量を常時表示");
            nm.createNotificationChannel(foregroundChannel);

            NotificationChannel uploadChannel = new NotificationChannel(
                    UPLOAD_CHANNEL_ID,
                    "365Cloud アップロード通知",
                    NotificationManager.IMPORTANCE_DEFAULT);
            uploadChannel.setDescription("アップロード進行状況と完了通知");
            nm.createNotificationChannel(uploadChannel);
        }
    }

    private String formatSize(long bytes) {
        if (bytes == 0) return "0 B";
        final String[] units = {"B", "KB", "MB", "GB"};
        int i = 0;
        while (bytes >= 1024 && i < units.length - 1) {
            bytes /= 1024;
            i++;
        }
        return String.format("%.1f %s", (double) bytes, units[i]);
    }

    private void updateForegroundNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE)
                : PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, FOREGROUND_CHANNEL_ID)
                .setContentTitle("365Cloud")
                .setContentText(storageInfo)
                .setSmallIcon(android.R.drawable.ic_menu_save)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
        }

        Notification notification = builder.build();

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(FOREGROUND_NOTIFICATION_ID, notification);
        }

        if (!running) {
            startForeground(FOREGROUND_NOTIFICATION_ID, notification);
            running = true;
        }
    }

    private void updateUploadNotification(boolean completed) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE)
                : PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, UPLOAD_CHANNEL_ID)
                .setContentIntent(pendingIntent)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);

        if (completed) {
            builder.setContentTitle("365Cloud")
                    .setContentText(uploadFileName + " のアップロードが完了しました")
                    .setSmallIcon(android.R.drawable.ic_menu_save)
                    .setOngoing(false)
                    .setAutoCancel(true);
        } else {
            String sizeText = uploadTotal > 0 ? formatSize(uploadLoaded) + " / " + formatSize(uploadTotal) : "";
            builder.setContentTitle("アップロード中")
                    .setContentText(uploadFileName + " (" + uploadPercent + "%)" + (sizeText.isEmpty() ? "" : " - " + sizeText))
                    .setSmallIcon(android.R.drawable.ic_menu_upload)
                    .setOngoing(false)
                    .setAutoCancel(false)
                    .setProgress(100, uploadPercent, false);
        }

        Notification notification = builder.build();

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(UPLOAD_NOTIFICATION_ID, notification);
        }
    }

    private void stopForegroundService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_START_FOREGROUND.equals(intent.getAction())) {
            updateForegroundNotification();
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopForegroundService();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        try {
            unregisterReceiver(receiver);
        } catch (Exception e) {
        }

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(FOREGROUND_NOTIFICATION_ID);
            nm.cancel(UPLOAD_NOTIFICATION_ID);
        }

        super.onDestroy();
    }
}
