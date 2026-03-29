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

public class ForegroundService extends Service {

    public static final String ACTION_START_FOREGROUND = "com.cloud365.view.action.START_FOREGROUND";
    public static final String ACTION_STOP_FOREGROUND = "com.cloud365.view.action.STOP_FOREGROUND";
    public static final String ACTION_STORAGE_UPDATE = "com.cloud365.view.action.STORAGE_UPDATE";
    public static final String ACTION_UPLOAD_PROGRESS = "com.cloud365.view.action.UPLOAD_PROGRESS";
    public static final String ACTION_UPLOAD_COMPLETE = "com.cloud365.view.action.UPLOAD_COMPLETE";

    private static final int NOTIFICATION_ID = 4201;
    private static final String CHANNEL_ID = "cloud365_service_channel";
    private static final String CHANNEL_NAME = "365Cloud Service";

    private String storageInfo = "使用容量: -- / --";
    private String currentFileName = "";
    private long currentFileSize = 0;
    private int currentProgress = 0;
    private boolean isUploading = false;
    private boolean running = false;
    private Handler handler;

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (action == null) return;

            if (ACTION_STORAGE_UPDATE.equals(action)) {
                String s = intent.getStringExtra("storageInfo");
                if (s != null && !s.isEmpty()) {
                    storageInfo = s;
                }
                updateNotification();

            } else if (ACTION_UPLOAD_PROGRESS.equals(action)) {
                String fileName = intent.getStringExtra("fileName");
                int percent = intent.getIntExtra("percent", 0);
                long size = intent.getLongExtra("size", 0);

                if (fileName != null && !fileName.isEmpty()) {
                    currentFileName = fileName;
                    currentFileSize = size > 0 ? size : currentFileSize;
                }
                currentProgress = percent;
                isUploading = true;
                updateNotification();

            } else if (ACTION_UPLOAD_COMPLETE.equals(action)) {
                String fileName = intent.getStringExtra("fileName");
                boolean success = intent.getBooleanExtra("success", false);

                isUploading = false;
                if (success) {
                    currentProgress = 100;
                    updateNotification();
                    handler.postDelayed(() -> {
                        currentFileName = "";
                        currentProgress = 0;
                        updateNotification();
                    }, 4000);
                } else {
                    updateNotification();
                    handler.postDelayed(() -> {
                        currentFileName = "";
                        currentProgress = 0;
                        updateNotification();
                    }, 6000);
                }
            } else if (ACTION_STOP_FOREGROUND.equals(action)) {
                stopForegroundService();
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        handler = new Handler(Looper.getMainLooper());

        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_STORAGE_UPDATE);
        filter.addAction(ACTION_STOP_FOREGROUND);
        filter.addAction(ACTION_UPLOAD_PROGRESS);
        filter.addAction(ACTION_UPLOAD_COMPLETE);

        registerReceiver(receiver, filter);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("365Cloud アップロード通知");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private void updateNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ?
                        PendingIntent.FLAG_IMMUTABLE : 0);

        String contentText = storageInfo;

        if (isUploading && !currentFileName.isEmpty()) {
            String sizeStr = currentFileSize > 0 ? " (" + formatSize(currentFileSize) + ")" : "";
            contentText += "\n" + currentFileName + sizeStr + "  " + currentProgress + "%";
        } else if (!currentFileName.isEmpty()) {
            contentText += "\n" + (currentProgress == 100 ? " 完了: " : "失敗: ") + currentFileName;
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("365Cloud")
                .setContentText(contentText)
                .setSmallIcon(android.R.drawable.ic_menu_upload)
                .setContentIntent(pendingIntent)
                .setOngoing(isUploading)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW);

        if (isUploading) {
            builder.setProgress(100, currentProgress, false);
        } else {
            builder.setProgress(0, 0, false);
        }

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

    private String formatSize(long bytes) {
        if (bytes <= 0) return "";
        final String[] units = {"B", "KB", "MB", "GB"};
        int digit = 0;
        double size = bytes;
        while (size >= 1024 && digit < units.length - 1) {
            size /= 1024;
            digit++;
        }
        return String.format("%.1f %s", size, units[digit]);
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
            updateNotification();
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
        } catch (Exception ignored) {}

        if (handler != null) {
            handler.removeCallbacksAndMessages(null);
        }

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(NOTIFICATION_ID);

        super.onDestroy();
    }
}
