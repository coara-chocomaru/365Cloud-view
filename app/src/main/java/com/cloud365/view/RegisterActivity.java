package com.cloud365.view;

import android.app.DownloadManager;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

import java.io.BufferedReader;
import java.io.InputStreamReader;

public class RegisterActivity extends AppCompatActivity {

    private static final String BASE_URL = "https://yuto-365.ddns.net/365Cloud/";

    private WebView webView;
    private ProgressBar progressBar;
    private OnBackPressedCallback backPressedCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        webView = findViewById(R.id.webview_register);
        progressBar = findViewById(R.id.progress_bar_register);

        setupWebView();
        webView.loadUrl(BASE_URL + "register.html");
        backPressedCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                startActivity(new Intent(RegisterActivity.this, LoginActivity.class));
                finish();
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backPressedCallback);
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
        webSettings.setMinimumFontSize(14);
        webSettings.setDefaultTextEncodingName("UTF-8");
        webSettings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING);

        String viewportContent = "width=device-width, initial-scale=0.95, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";
        String jsViewport = "javascript:(function(){if(document.querySelector('meta[name=viewport]')===null){" +
                "var meta=document.createElement('meta');meta.name='viewport';meta.content='" + viewportContent + "';document.head.appendChild(meta);" +
                "}}())";
        
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                progressBar.setVisibility(View.VISIBLE);
                webView.evaluateJavascript(jsViewport, null);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setVisibility(View.GONE);
                injectOptimizedCSS();
                applyMobileOptimizations();
                
                if (url.contains("login.html")) {
                    startActivity(new Intent(RegisterActivity.this, LoginActivity.class));
                    finish();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.contains("login.html")) {
                    startActivity(new Intent(RegisterActivity.this, LoginActivity.class));
                    finish();
                    return true;
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                super.onProgressChanged(view, newProgress);
                progressBar.setProgress(newProgress);
            }
        });
        webView.setDownloadListener(new DownloadListener() {
            public void onDownloadStart(String url, String userAgent, String contentDisposition, 
                                      String mimeType, long contentLength) {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimeType);
                String cookies = CookieManager.getInstance().getCookie(url);
                request.addRequestHeader("cookie", cookies);
                request.addRequestHeader("User-Agent", userAgent);
                request.setDescription("365Cloud ファイルダウンロード中...");
                request.setTitle("ダウンロード");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, 
                    contentDisposition != null ? 
                    contentDisposition.replaceFirst("(?i)[^\\w\\.-]+", "") : "unknown_file");
                
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                dm.enqueue(request);
                Toast.makeText(RegisterActivity.this, "ダウンロードを開始しました", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void injectOptimizedCSS() {
        try {
            InputStreamReader isr = new InputStreamReader(getAssets().open("optimized_365Cloud.css"));
            BufferedReader br = new BufferedReader(isr);
            StringBuilder cssBuilder = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                cssBuilder.append(line).append("\n");
            }
            br.close();

            String css = cssBuilder.toString()
                    .replace("\\", "\\\\")
                    .replace("'", "\\'")
                    .replace("\n", "\\n")
                    .replace("\"", "\\\"");

            String js = "javascript:(function() {" +
                    "if(!document.getElementById('optimized-css')) {" +
                    "var style = document.createElement('style');" +
                    "style.id = 'optimized-css';" +
                    "style.type = 'text/css';" +
                    "style.innerHTML = '" + css + "';" +
                    "document.head.appendChild(style);" +
                    "}" +
                    "})()";

            webView.evaluateJavascript(js, null);
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(this, "CSS 注入に失敗しました: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void applyMobileOptimizations() {
        String mobileOptJs = "javascript:(function() {" +
                "document.body.style.fontSize = '15px';" +
                "var container = document.querySelector('.container');" +
                "if(container) {" +
                "container.style.padding = '20px';" +
                "container.style.width = '100%';" +
                "container.style.maxWidth = '100%';" +
                "container.style.margin = '0 auto';" +
                "container.style.boxSizing = 'border-box';" +
                "}" +
                "var inputs = document.querySelectorAll('input[type=text], input[type=password]');" +
                "for(var i=0; i<inputs.length; i++) {" +
                "inputs[i].style.fontSize = '15px';" +
                "inputs[i].style.padding = '10px 12px 10px 30px';" +
                "inputs[i].style.height = '40px';" +
                "inputs[i].style.marginBottom = '10px';" +
                "inputs[i].style.boxSizing = 'border-box';" +
                "inputs[i].style.width = '100%';" +
                "inputs[i].style.backgroundColor = '#ffffff';" +
                "inputs[i].style.color = '#000000';" +
                "inputs[i].addEventListener('focus', function() { this.style.backgroundColor = '#f0f0f0'; this.style.color = '#000000'; });" +
                "inputs[i].addEventListener('blur', function() { this.style.backgroundColor = '#ffffff'; this.style.color = '#000000'; });" +
                "}" +
                "var buttons = document.querySelectorAll('button');" +
                "for(var j=0; j<buttons.length; j++) {" +
                "buttons[j].style.fontSize = '15px';" +
                "buttons[j].style.padding = '10px 15px';" +
                "buttons[j].style.height = '40px';" +
                "buttons[j].style.minWidth = '100px';" +
                "buttons[j].style.boxSizing = 'border-box';" +
                "buttons[j].style.width = '100%';" +
                "buttons[j].addEventListener('touchstart', function(e){ this.style.transform='scale(0.98)'; });" +
                "buttons[j].addEventListener('touchend', function(e){ this.style.transform='scale(1)'; });" +
                "}" +
                "var h1 = document.querySelector('h1');" +
                "if(h1) { h1.style.fontSize = '28px'; }" +
                "var message = document.getElementById('register-message');" +
                "if(message) { message.style.fontSize = '14px'; message.style.marginTop = '20px'; }" +
                "if(window.innerWidth <= 768) {" +
                "document.body.style.padding = '10px';" +
                "}" +
                "})()";
        webView.evaluateJavascript(mobileOptJs, null);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            startActivity(new Intent(RegisterActivity.this, LoginActivity.class));
            finish();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (backPressedCallback != null) {
            backPressedCallback.setEnabled(false);
        }
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    @Override
    protected void onPause() {
        super.onPause();
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
        }
    }
}
