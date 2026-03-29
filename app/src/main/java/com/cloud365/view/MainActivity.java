package com.cloud365.view;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.view.View;
import android.webkit.ClientCertRequest;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {

    private static final String BASE_URL = "https://yuto-365.ddns.net/365Cloud/";
    private static final String PREFS_NAME = "LoginPrefs";
    private static final String KEY_COOKIES = "cookies";
    private static final String ASSET_INDEX_HTML = "index.html";
    private static final String ASSET_INDEX_JS = "indexhtml.js";
    private static final String ASSET_SETTINGS_HTML = "settings.html";
    private static final String ASSET_SHARE_MANAGEMENT_HTML = "share-management.html";
    private static final int FILE_CHOOSER_RESULT_CODE = 1;
    private static final int REQ_POST_NOTIF = 101;
    private static final int REQ_STORAGE = 102;

    private WebView webView;
    private ProgressBar progressBar;
    private SharedPreferences sharedPreferences;
    private OnBackPressedCallback backPressedCallback;
    private DownloadManager downloadManager;
    private long lastDownloadId = -1;
    private Handler handler;
    private ValueCallback<Uri[]> filePathCallback;
    private long lastBackPressTime = 0;
    private static final long DOUBLE_PRESS_INTERVAL = 500;

    private Runnable autoRefreshRunnable;
    private boolean isAutoRefreshRunning = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview_main);
        progressBar = findViewById(R.id.progress_bar_main);
        sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        downloadManager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
        handler = new Handler(Looper.getMainLooper());

        Intent fg = new Intent(this, ForegroundService.class);
        fg.setAction(ForegroundService.ACTION_START_FOREGROUND);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(fg);
        } else {
            startService(fg);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_POST_NOTIF);
            }
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
            }
        }

        setupWebView();
        loadMainPage();
    }

    private void setupWebView() {
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setSupportMultipleWindows(true);
        webSettings.setJavaScriptCanOpenWindowsAutomatically(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setSupportZoom(true);
        webSettings.setBuiltInZoomControls(true);
        webSettings.setDisplayZoomControls(false);
        webSettings.setTextZoom(100);
        webSettings.setDefaultFontSize(16);
        webSettings.setDefaultTextEncodingName("UTF-8");
        webSettings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING);
        webSettings.setBlockNetworkImage(false);
        webSettings.setLoadsImagesAutomatically(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);

        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus();

        String viewportContent = "width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover";
        final String jsViewport = "javascript:(function(){var meta=document.querySelector('meta[name=viewport]');if(meta){meta.content='" + viewportContent + "';}else{meta=document.createElement('meta');meta.name='viewport';meta.content='" + viewportContent + "';document.head.appendChild(meta);} })()";

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidAppBridge");
        webView.addJavascriptInterface(new WebAppInterface(this), "Android");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setVisibility(View.GONE);
                view.evaluateJavascript(jsViewport, null);

                if (!isLocalAssetPageUrl(url)) {
                    applyMobileOptimizations();
                }

                saveCookies();

                view.evaluateJavascript("(function(){\nif(window._cloud365Injected) return;\nwindow._cloud365Injected = true;\nfunction sendStorageInfoIfExists(){\n  try{\n    var el = document.getElementById('storage-info') || document.querySelector('[data-storage-info]');\n    if(el){\n      var text = (typeof el.innerText !== 'undefined')? el.innerText : (el.textContent||'');\n      if(window.AndroidAppBridge && AndroidAppBridge.sendStorageInfo) AndroidAppBridge.sendStorageInfo(text);\n      return true;\n    }\n    if (typeof getStorageInfo === 'function'){\n      try{\n        var val = getStorageInfo();\n        if(val && window.AndroidAppBridge && AndroidAppBridge.sendStorageInfo) AndroidAppBridge.sendStorageInfo(String(val));\n        return true;\n      }catch(e){}\n    }\n  }catch(e){}\n  return false;\n}\nfunction observeStorage(){\n  try{\n    var el = document.getElementById('storage-info') || document.querySelector('[data-storage-info]');\n    if(el){\n      try{ if(window.AndroidAppBridge && AndroidAppBridge.sendStorageInfo) AndroidAppBridge.sendStorageInfo(el.innerText||el.textContent||''); }catch(e){}\n      var mo = new MutationObserver(function(){ try{ if(window.AndroidAppBridge && AndroidAppBridge.sendStorageInfo) AndroidAppBridge.sendStorageInfo(el.innerText||el.textContent||''); }catch(e){} });\n      mo.observe(el,{childList:true,characterData:true,subtree:true});\n      return;\n    }\n  }catch(e){}\n  var tries = 0;\n  var maxTries = 30;\n  var poll = setInterval(function(){\n    tries++;\n    if(sendStorageInfoIfExists() || tries>=maxTries) clearInterval(poll);\n  },1000);\n}\nvar deselectBtn=document.querySelector('.nav-item[data-target=\"files\"]');if(deselectBtn){deselectBtn.addEventListener('click',function(){try{var fileInput=document.getElementById('file-upload')||document.querySelector('input[type=\"file\"]');var hasFiles=fileInput&&fileInput.files&&fileInput.files.length>0;if(hasFiles){if(window.AndroidAppBridge&&AndroidAppBridge.fileDeselected)AndroidAppBridge.fileDeselected();}else{if(window.AndroidAppBridge&&AndroidAppBridge.fileNotSelected)AndroidAppBridge.fileNotSelected();}}catch(e){}},true);}document.getElementById('upload-button').addEventListener('click',function(){var fileInput=document.getElementById('file-upload');if(!fileInput||!fileInput.files||fileInput.files.length===0){if(window.AndroidAppBridge&&AndroidAppBridge.showToast)AndroidAppBridge.showToast('ファイルを選択してください');}},true);})();", null);

                view.evaluateJavascript("(function(){var e=document.getElementById('storage-info'); if(e) return e.innerText; if(typeof getStorageInfo === 'function') return getStorageInfo(); return null; })();", value -> {
                    if (value != null && !"null".equals(value)) {
                        String storage = value.replaceAll("^\\\"|\\\"$", "").replace("\\\\n", "\n");
                        broadcastStorageUpdate(storage);
                    }
                });

                view.evaluateJavascript("(function(){try { var el = document.querySelector('label[for=\"file-upload\"]'); if (el && el.parentElement) { el.parentElement.style.display = 'none'; } } catch(e) {} })();", null);

                if (url.contains("login.html") || url.contains("register.html")) {
                    redirectToLogin();
                    return;
                }

                startAutoRefreshIfNeeded();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();

                if (isLocalAssetPageUrl(url)) {
                    loadAssetPageFromUrl(url);
                    return true;
                }

                if (url.contains("login.html") || url.contains("register.html")) {
                    redirectToLogin();
                    return true;
                }

                if (url.contains("/download")) {
                    startDownload(url);
                    return true;
                }

                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                handleWebError(error.getDescription().toString());
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                super.onReceivedHttpError(view, request, errorResponse);
                handleWebError(errorResponse.getReasonPhrase());
            }

            @Override
            public void onReceivedClientCertRequest(WebView view, ClientCertRequest request) {
                request.cancel();
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                try {
                    String path = request.getUrl().getPath();
                    if (path == null) return super.shouldInterceptRequest(view, request);

                    if (isIndexJsPath(path)) {
                        InputStream is = getAssetStream(ASSET_INDEX_JS);
                        if (is != null) return new WebResourceResponse("application/javascript", "UTF-8", is);
                    }
                    if (isIndexHtmlPath(path)) {
                        InputStream is = getAssetStream(ASSET_INDEX_HTML);
                        if (is != null) return new WebResourceResponse("text/html", "UTF-8", is);
                    }
                    if (isSettingsHtmlPath(path)) {
                        InputStream is = getAssetStream(ASSET_SETTINGS_HTML);
                        if (is != null) return new WebResourceResponse("text/html", "UTF-8", is);
                    }
                    if (isShareManagementHtmlPath(path)) {
                        InputStream is = getAssetStream(ASSET_SHARE_MANAGEMENT_HTML);
                        if (is != null) return new WebResourceResponse("text/html", "UTF-8", is);
                    }
                } catch (Exception ignored) {}

                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                try {
                    String path = Uri.parse(url).getPath();
                    if (path == null) return super.shouldInterceptRequest(view, url);

                    if (isIndexJsPath(path)) {
                        InputStream is = getAssetStream(ASSET_INDEX_JS);
                        if (is != null) return new WebResourceResponse("application/javascript", "UTF-8", is);
                    }
                    if (isIndexHtmlPath(path)) {
                        InputStream is = getAssetStream(ASSET_INDEX_HTML);
                        if (is != null) return new WebResourceResponse("text/html", "UTF-8", is);
                    }
                    if (isSettingsHtmlPath(path)) {
                        InputStream is = getAssetStream(ASSET_SETTINGS_HTML);
                        if (is != null) return new WebResourceResponse("text/html", "UTF-8", is);
                    }
                    if (isShareManagementHtmlPath(path)) {
                        InputStream is = getAssetStream(ASSET_SHARE_MANAGEMENT_HTML);
                        if (is != null) return new WebResourceResponse("text/html", "UTF-8", is);
                    }
                } catch (Exception ignored) {}

                return super.shouldInterceptRequest(view, url);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                super.onProgressChanged(view, newProgress);
                progressBar.setProgress(newProgress);
            }

            @Override
            public boolean onShowFileChooser(WebView wv, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_RESULT_CODE);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    Toast.makeText(MainActivity.this, "ファイル選択に失敗しました", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                startDownload(url);
            }
        });

        backPressedCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleBackPressed();
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backPressedCallback);
    }

    private boolean isIndexJsPath(String path) {
        return path != null && path.endsWith("/" + ASSET_INDEX_JS);
    }

    private boolean isIndexHtmlPath(String path) {
        return path != null && path.endsWith("/" + ASSET_INDEX_HTML);
    }

    private boolean isSettingsHtmlPath(String path) {
        return path != null && path.endsWith("/" + ASSET_SETTINGS_HTML);
    }

    private boolean isShareManagementHtmlPath(String path) {
        return path != null && path.endsWith("/" + ASSET_SHARE_MANAGEMENT_HTML);
    }

    private boolean isLocalAssetPageUrl(String url) {
        if (url == null) return false;
        try {
            String path = Uri.parse(url).getPath();
            return isSettingsHtmlPath(path) || isShareManagementHtmlPath(path);
        } catch (Exception e) {
            return false;
        }
    }

    private void loadAssetPageFromUrl(String url) {
        try {
            String path = Uri.parse(url).getPath();
            if (path == null) return;

            if (isSettingsHtmlPath(path)) {
                loadAssetPage(ASSET_SETTINGS_HTML, url);
            } else if (isShareManagementHtmlPath(path)) {
                loadAssetPage(ASSET_SHARE_MANAGEMENT_HTML, url);
            }
        } catch (Exception ignored) {}
    }

    private void loadAssetPage(String assetName, String historyUrl) {
        String html = readAssetFile(assetName);
        if (html != null) {
            webView.loadDataWithBaseURL(BASE_URL, html, "text/html", "UTF-8", historyUrl);
        } else {
            webView.loadUrl(BASE_URL + assetName);
        }
    }

    private void handleBackPressed() {
        if (webView.canGoBack()) {
            webView.evaluateJavascript(
                    "(function(){" +
                            "  return (window._cloud365ActiveUploads && Object.keys(window._cloud365ActiveUploads).length > 0) ? 'uploading' : 'safe';" +
                            "})();",
                    value -> {
                        if ("\"uploading\"".equals(value)) {
                            Toast.makeText(MainActivity.this, "アップロード中です。完了してから戻ってください", Toast.LENGTH_SHORT).show();
                        }
                        webView.goBack();
                    });
        } else {
            long currentTime = System.currentTimeMillis();
            if (currentTime - lastBackPressTime < DOUBLE_PRESS_INTERVAL) {
                finish();
            } else {
                lastBackPressTime = currentTime;
                Toast.makeText(this, "もう一度押すと終了します", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void startAutoRefreshIfNeeded() {
        if (autoRefreshRunnable == null) {
            autoRefreshRunnable = () -> {
                if (isFinishing() || webView == null || !isAutoRefreshRunning) return;
                webView.evaluateJavascript("window.location.href", value -> {
                    if (value != null && !"null".equals(value)) {
                        String currentUrl = value.replace("\"", "");
                        if (currentUrl.contains("index.html") && !currentUrl.contains("#")) {
                            webView.reload();
                        }
                    }
                });
                if (isAutoRefreshRunning && !isFinishing()) {
                    handler.postDelayed(autoRefreshRunnable, 30000);
                }
            };
        }
        if (!isAutoRefreshRunning) {
            isAutoRefreshRunning = true;
            handler.postDelayed(autoRefreshRunnable, 30000);
        }
    }

    private void stopAutoRefresh() {
        isAutoRefreshRunning = false;
        if (handler != null && autoRefreshRunnable != null) {
            handler.removeCallbacks(autoRefreshRunnable);
        }
    }

    private InputStream getAssetStream(String name) {
        try {
            return getAssets().open(name);
        } catch (IOException e) {
            return null;
        }
    }

    private void startDownload(String url) {
        try {
            Uri uri = Uri.parse(url);
            String fileName = uri.getQueryParameter("file");
            if (fileName == null) {
                fileName = "365Cloud_file";
            } else {
                fileName = Uri.decode(fileName);
                int lastSlash = fileName.lastIndexOf('/');
                if (lastSlash >= 0) {
                    fileName = fileName.substring(lastSlash + 1);
                }
            }
            String mimeType = getMimeType(url);
            if (mimeType == null) mimeType = "application/octet-stream";

            DownloadManager.Request request = new DownloadManager.Request(uri);
            request.setMimeType(mimeType);
            request.addRequestHeader("cookie", CookieManager.getInstance().getCookie(url));
            request.addRequestHeader("User-Agent", webView.getSettings().getUserAgentString());
            request.setDescription("365Cloud ファイルダウンロード中...");
            request.setTitle(fileName);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, fileName);

            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                Toast.makeText(this, "ストレージ権限が必要です。", Toast.LENGTH_SHORT).show();
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
                return;
            }

            lastDownloadId = downloadManager.enqueue(request);
            Toast.makeText(this, "ダウンロードを開始しました: " + fileName, Toast.LENGTH_SHORT).show();

        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(this, "ダウンロードに失敗しました: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private String getMimeType(String url) {
        try {
            int idx = url.lastIndexOf(".");
            if (idx == -1) return null;
            String extension = url.substring(idx + 1).toLowerCase(Locale.ROOT);
            switch (extension) {
                case "jpg":
                case "jpeg":
                    return "image/jpeg";
                case "png":
                    return "image/png";
                case "pdf":
                    return "application/pdf";
                case "txt":
                    return "text/plain";
                case "mp4":
                    return "video/mp4";
                default:
                    return null;
            }
        } catch (Exception e) {
            return null;
        }
    }

    private String getFileNameFromUri(Uri uri) {
        if (uri == null) return null;
        String result = null;
        if ("content".equals(uri.getScheme())) {
            Cursor cursor = null;
            try {
                cursor = getContentResolver().query(uri, null, null, null, null);
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIndex != -1) {
                        result = cursor.getString(nameIndex);
                    }
                }
            } catch (Exception ignored) {
            } finally {
                if (cursor != null) cursor.close();
            }
        }
        if (result == null || result.trim().isEmpty()) {
            String path = uri.getPath();
            if (path != null) {
                int cut = path.lastIndexOf('/');
                if (cut != -1) {
                    result = path.substring(cut + 1);
                } else {
                    result = path;
                }
            }
        }
        return result;
    }

    private void loadMainPage() {
        restoreCookies();
        String html = readAssetFile(ASSET_INDEX_HTML);
        if (html != null) {
            webView.loadDataWithBaseURL(BASE_URL, html, "text/html", "UTF-8", BASE_URL + ASSET_INDEX_HTML);
        } else {
            webView.loadUrl(BASE_URL + ASSET_INDEX_HTML);
        }
    }

    private String readAssetFile(String name) {
        try {
            InputStream is = getAssets().open(name);
            BufferedReader br = new BufferedReader(new InputStreamReader(is, "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line).append("\n");
            }
            br.close();
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private void restoreCookies() {
        String savedCookies = sharedPreferences.getString(KEY_COOKIES, null);
        if (savedCookies != null) {
            CookieManager.getInstance().setCookie(BASE_URL, savedCookies);
            CookieManager.getInstance().flush();
        }
    }

    private void saveCookies() {
        String cookies = CookieManager.getInstance().getCookie(BASE_URL);
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.putString(KEY_COOKIES, cookies);
        editor.apply();
    }

    private void redirectToLogin() {
        startActivity(new Intent(MainActivity.this, LoginActivity.class));
        finish();
    }

    private void handleWebError(String error) {
        Toast.makeText(this, "エラー: " + error, Toast.LENGTH_SHORT).show();
    }

    private void applyMobileOptimizations() {
        String mobileOptJs = "javascript:(function() { (function(win, doc){ try{ var meta=document.querySelector('meta[name=viewport]'); if(meta){ meta.content='width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover'; } else { meta=document.createElement('meta'); meta.name='viewport'; meta.content='width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover'; document.head.appendChild(meta); } var css = 'html,body{max-width:100%!important;overflow-x:hidden!important;box-sizing:border-box!important;}*{max-width:100%!important;box-sizing:border-box!important;}img,video,table,iframe{max-width:100%!important;height:auto!important;}.container,.content,.main,.wrapper{width:100%!important;} img[src*=\"365Cloud_Mainicon.png\"],img[src$=\"365Cloud_Mainicon.png\"]{display:none!important;visibility:hidden!important;width:0!important;height:0!important;margin:0!important;padding:0!important;border:none!important;opacity:0!important;}'; var style = doc.createElement('style'); style.innerHTML = css; doc.head.appendChild(style); if('ontouchstart' in window){ document.documentElement.style.webkitTouchCallout='none'; document.documentElement.style.webkitUserSelect='none'; } var preventDoubleTap = (function(){ var lastTouch=0; return function(e){ var now=Date.now(); if(now - lastTouch <= 300){ e.preventDefault(); } lastTouch = now; }; })(); doc.addEventListener('touchend', preventDoubleTap, {passive:false}); doc.addEventListener('gesturestart', function(e){ e.preventDefault(); }, {passive:false}); var iosMeta = function(){ var ua=navigator.userAgent||''; if(/iP(hone|od|ad)/.test(ua)){ doc.documentElement.classList.add('is-ios'); } }; iosMeta(); } catch(err){} })(window, document); })()";
        webView.evaluateJavascript(mobileOptJs, null);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK) {
                if (data != null) {
                    String dataString = data.getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    } else if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
            }
            filePathCallback.onReceiveValue(results);
            if (results != null && results.length > 0) {
                StringBuilder sb = new StringBuilder();
                for (Uri u : results) {
                    String name = getFileNameFromUri(u);
                    if (name != null && !name.isEmpty()) {
                        if (sb.length() > 0) sb.append(", ");
                        sb.append(name);
                    }
                }
                String msg = sb.length() > 0 ? sb.toString() + " ファイルが選択されました" : "ファイルが選択されました";
                Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show();
            }
            filePathCallback = null;
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        stopAutoRefresh();
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
            CookieManager cookieManager = CookieManager.getInstance();
            String savedCookies = sharedPreferences.getString(KEY_COOKIES, null);
            if (savedCookies != null) {
                cookieManager.setCookie(BASE_URL, savedCookies);
                cookieManager.flush();
            }
        }
        startAutoRefreshIfNeeded();
    }

    @Override
    protected void onDestroy() {
        stopAutoRefresh();
        if (backPressedCallback != null) {
            backPressedCallback.setEnabled(false);
            backPressedCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.setWebViewClient(null);
            webView.setWebChromeClient(null);
            webView.removeJavascriptInterface("AndroidAppBridge");
            webView.removeJavascriptInterface("Android");
            webView.clearHistory();
            webView.clearCache(true);
            webView.destroy();
            webView = null;
        }
        handler.removeCallbacksAndMessages(null);
        handler = null;
        super.onDestroy();
    }

    private void sendBroadcastToService(Intent intent) {
        if (intent == null) return;
        try {
            sendBroadcast(intent);
        } catch (Exception ignored) {}
    }

    private void broadcastStorageUpdate(String storage) {
        Intent i = new Intent(ForegroundService.ACTION_STORAGE_UPDATE);
        i.putExtra("storageInfo", storage != null ? storage : "");
        sendBroadcastToService(i);
    }

    private class WebAppInterface {
        Context ctx;

        WebAppInterface(Context c) {
            ctx = c;
        }

        @JavascriptInterface
        public void sendStorageInfo(String info) {
            if (isFinishing()) return;
            broadcastStorageUpdate(info);
            broadcastStorageUpdate(storage);
        }

        @JavascriptInterface
        public void fileDeselected() {
            if (isFinishing()) return;
            handler.post(() -> Toast.makeText(MainActivity.this, "ファイルが解除されました", Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void fileNotSelected() {
            if (isFinishing()) return;
            handler.post(() -> Toast.makeText(MainActivity.this, "ファイルは選択されていません", Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void showToast(String message) {
            if (isFinishing()) return;
            handler.post(() -> Toast.makeText(ctx, message, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void uploadProgress(String fileName, int percent, long loaded, long total) {
            if (isFinishing()) return;
            Intent i = new Intent(ForegroundService.ACTION_UPLOAD_PROGRESS);
            i.putExtra("fileName", fileName);
            i.putExtra("percent", percent);
            i.putExtra("loaded", loaded);
            i.putExtra("total", total);
            sendBroadcastToService(i);
        }

        @JavascriptInterface
        public void uploadComplete(String fileName, boolean success, String message) {
            if (isFinishing()) return;
            Intent i = new Intent(ForegroundService.ACTION_UPLOAD_FINISHED);
            sendBroadcastToService(i);
        }

        @JavascriptInterface
        public void deleteCompleted() {
            broadcastStorageUpdate(storage);
            if (isFinishing()) return;
            Intent i = new Intent(ForegroundService.ACTION_DELETE_COMPLETED);
            sendBroadcastToService(i);
        }
    }
}
