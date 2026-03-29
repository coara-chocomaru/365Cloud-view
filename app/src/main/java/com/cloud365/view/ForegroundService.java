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

    private static final int NOTIFICATION_ID = 4201;
    private static final int UPLOAD_NOTIFICATION_ID = 4202;
    private static final String CHANNEL_ID = "cloud365_service_channel";
    private static final String CHANNEL_NAME = "365Cloud Service";

    private String storageInfo = "使用容量: -- / --";
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
                String fileName = intent.getStringExtra("fileName");
                int percent = intent.getIntExtra("percent", 0);
                long loaded = intent.getLongExtra("loaded", 0);
                long total = intent.getLongExtra("total", 1);
                updateUploadNotification(fileName, percent, loaded, total, false);
            } else if (ACTION_UPLOAD_FINISHED.equals(action)) {
                updateUploadNotification("", 100, 0, 0, true);
            } else if (ACTION_STOP_FOREGROUND.equals(action)) {
                stopForegroundService();
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_STORAGE_UPDATE);
        filter.addAction(ACTION_UPLOAD_PROGRESS);
        filter.addAction(ACTION_UPLOAD_FINISHED);
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
        PendingIntent pendingIntent;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);
        } else {
            pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, 0);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("365Cloud")
                .setContentText(storageInfo)
                .setSmallIcon(android.R.drawable.ic_menu_save)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setProgress(0, 0, false);

        Notification notification = builder.build();

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, notification);
        }

        if (!running) {
            startForeground(NOTIFICATION_ID, notification);
            running = true;
        }
    }

    private void updateUploadNotification(String fileName, int percent, long loaded, long total, boolean completed) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);
        } else {
            pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, 0);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentIntent(pendingIntent)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);

        if (completed) {
            builder.setContentTitle("365Cloud")
                    .setContentText(fileName + " のアップロードが完了しました")
                    .setSmallIcon(android.R.drawable.ic_menu_save)
                    .setOngoing(false)
                    .setAutoCancel(true);
        } else {
            String sizeText = total > 0 ? formatSize(loaded) + " / " + formatSize(total) : "";
            builder.setContentTitle("アップロード中")
                    .setContentText(fileName + " (" + percent + "%)" + (sizeText.isEmpty() ? "" : " - " + sizeText))
                    .setSmallIcon(android.R.drawable.ic_menu_upload)
                    .setOngoing(false)
                    .setAutoCancel(false)
                    .setProgress(100, percent, false);
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
            nm.cancel(NOTIFICATION_ID);
            nm.cancel(UPLOAD_NOTIFICATION_ID);
        }

        super.onDestroy();
    }
}
