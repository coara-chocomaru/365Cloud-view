package com.cloud365.view;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
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

public class LoginActivity extends AppCompatActivity {

    private static final String BASE_URL = "https://yuto-365.ddns.net/365Cloud/";
    private static final String PREFS_NAME = "LoginPrefs";
    private static final String KEY_USERNAME = "username";
    private static final String KEY_PASSWORD = "password";
    private static final String KEY_AUTO_LOGIN = "auto_login";

    private WebView webView;
    private ProgressBar progressBar;
    private SharedPreferences sharedPreferences;
    private boolean autoLoginEnabled = false;
    private OnBackPressedCallback backPressedCallback;
    private long lastBackPressTime = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        webView = findViewById(R.id.webview_login);
        progressBar = findViewById(R.id.progress_bar_login);
        sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        clearCookiesAndCache(new ValueCallback<Boolean>() {
            @Override
            public void onReceiveValue(Boolean value) {
                setupWebView();
                checkSavedCredentials();
            }
        });

        backPressedCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    long currentTime = System.currentTimeMillis();
                    if (currentTime - lastBackPressTime < 2000) {
                        finish();
                    } else {
                        lastBackPressTime = currentTime;
                        Toast.makeText(LoginActivity.this, "もう一度押すと終了します", Toast.LENGTH_SHORT).show();
                    }
                }
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backPressedCallback);
    }

    private void clearCookiesAndCache(final ValueCallback<Boolean> callback) {
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.removeAllCookies(new ValueCallback<Boolean>() {
            @Override
            public void onReceiveValue(Boolean value) {
                cookieManager.flush();
                webView.clearCache(true);
                webView.clearHistory();
                webView.clearFormData();
                if (callback != null) {
                    callback.onReceiveValue(true);
                }
            }
        });
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
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);
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
        webSettings.setBlockNetworkImage(false);
        webSettings.setLoadsImagesAutomatically(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);

        String viewportContent = "width=device-width, initial-scale=0.95, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";
        String jsViewport = "javascript:(function(){if(document.querySelector('meta[name=viewport]')===null){" +
                "var meta=document.createElement('meta');meta.name='viewport';meta.content='" + viewportContent + "';document.head.appendChild(meta);" +
                "}}())";
        
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new WebAppInterface(this), "Android");

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
                
                if (url.contains("index.html")) {
                    saveLoginSuccess();
                    Intent intent = new Intent(LoginActivity.this, MainActivity.class);
                    startActivity(intent);
                    finish();
                } else if (url.contains("register.html")) {
                    startActivity(new Intent(LoginActivity.this, RegisterActivity.class));
                    finish();
                }
                if (url.contains("login.html")) {
                    String injectJs = "javascript:(function() {" +
                            "var form = document.getElementById('login-form');" +
                            "if (form) {" +
                            "form.addEventListener('submit', function(e) {" +
                            "var username = document.querySelector('input[name=\"username\"]').value;" +
                            "var password = document.querySelector('input[name=\"password\"]').value;" +
                            "Android.saveCredentials(username, password);" +
                            "});" +
                            "}" +
                            "})()";
                    webView.evaluateJavascript(injectJs, null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.contains("index.html")) {
                    saveLoginSuccess();
                    Intent intent = new Intent(LoginActivity.this, MainActivity.class);
                    startActivity(intent);
                    finish();
                    return true;
                } else if (url.contains("register.html")) {
                    startActivity(new Intent(LoginActivity.this, RegisterActivity.class));
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
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, contentDisposition != null ? 
                    contentDisposition.replaceFirst("(?i)[^\\w\\.-]+", "") : "unknown_file");
                
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                dm.enqueue(request);
                Toast.makeText(LoginActivity.this, "ダウンロードを開始しました", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void checkSavedCredentials() {
        autoLoginEnabled = sharedPreferences.getBoolean(KEY_AUTO_LOGIN, true);
        String savedUsername = sharedPreferences.getString(KEY_USERNAME, null);
        String savedPassword = sharedPreferences.getString(KEY_PASSWORD, null);

        if (autoLoginEnabled && savedUsername != null && savedPassword != null) {
            webView.loadUrl(BASE_URL + "login.html");
            webView.postDelayed(() -> {
                String js = "javascript:(function() {" +
                        "var usernameField = document.querySelector('input[name=\"username\"]');" +
                        "var passwordField = document.querySelector('input[name=\"password\"]');" +
                        "var submitButton = document.querySelector('button[type=\"submit\"]');" +
                        "if(usernameField && passwordField && submitButton) {" +
                        "usernameField.value = '" + savedUsername.replace("'", "\\'") + "';" +
                        "passwordField.value = '" + savedPassword.replace("'", "\\'") + "';" +
                        "submitButton.click();" +
                        "}" +
                        "})()";
                webView.evaluateJavascript(js, null);
            }, 2000); 
        } else {
            webView.loadUrl(BASE_URL + "login.html");
        }
    }

    private void saveLoginSuccess() {
        CookieManager cookieManager = CookieManager.getInstance();
        String cookies = cookieManager.getCookie(BASE_URL);
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.putString("cookies", cookies);
        editor.apply();
        cookieManager.flush(); 
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
                "document.body.style.overflow = 'auto';" +
                "var meta = document.querySelector('meta[name=viewport]');" +
                "if(meta) { meta.content = 'width=device-width, initial-scale=0.95, maximum-scale=1.0, user-scalable=no'; }" +
                "else {" +
                "var newMeta = document.createElement('meta'); newMeta.name='viewport'; newMeta.content='width=device-width, initial-scale=0.95, maximum-scale=1.0, user-scalable=no'; document.head.appendChild(newMeta);" +
                "}" +
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
                "var message = document.getElementById('message');" +
                "if(message) { message.style.fontSize = '14px'; message.style.marginTop = '20px'; }" +
                "if(window.innerWidth <= 768) {" +
                "document.body.style.padding = '10px';" +
                "}" +
                "})()";
        webView.evaluateJavascript(mobileOptJs, null);
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
        webView.onPause();
        webView.pauseTimers();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        webView.resumeTimers();
    }

    public class WebAppInterface {
        Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void saveCredentials(String username, String password) {
            SharedPreferences prefs = mContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString(KEY_USERNAME, username);
            editor.putString(KEY_PASSWORD, password);
            editor.putBoolean(KEY_AUTO_LOGIN, true);
            editor.apply();
        }
    }
}
