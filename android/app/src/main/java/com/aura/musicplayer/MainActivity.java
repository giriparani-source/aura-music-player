package com.aura.musicplayer;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int REQ_POST_NOTIFICATIONS = 101;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AuraMediaPlugin.class);
        super.onCreate(savedInstanceState);

        // SEC-01 FIX: Only enable WebView debugging in debug builds.
        // In release builds, Chrome DevTools cannot attach to inspect app data.
        boolean isDebug = (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(isDebug);

        configureSystemBars();
        configureWebView();
        requestAppPermissionsIfNeeded();
    }

    private void configureSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Window window = getWindow();
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.parseColor("#0b0d13"));
            window.setNavigationBarColor(Color.parseColor("#0e1118"));

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Ensure status bar icons remain light/white on our dark background
                View decor = window.getDecorView();
                int flags = decor.getSystemUiVisibility();
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                decor.setSystemUiVisibility(flags);
            }
        }

        // Guarantee layout is fitted below system bars & camera cutouts across all Android OEM skins
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setFitsSystemWindows(true);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Keep Chromium WebView active for background audio and iframe playback
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().onResume();
            bridge.getWebView().resumeTimers();
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        // Ensure seamless continuous playback & autoplay when screen turns off or app is backgrounded
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().onResume();
            bridge.getWebView().resumeTimers();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Guarantee timers and audio threads stay awake when phone screen locks or shade is pulled down
        if (!hasFocus && bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().onResume();
            bridge.getWebView().resumeTimers();
        }
    }

    private void configureWebView() {
        if (bridge != null && bridge.getWebView() != null) {
            WebView webView = bridge.getWebView();
            WebSettings settings = webView.getSettings();

            // Enforce hardware acceleration layer on budget chipsets (MediaTek/Unisoc/Snapdragon)
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

            // Crucial for seamless background audio and auto-play
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                // SEC-02 FIX: Tightened from ALWAYS_ALLOW to COMPATIBILITY_MODE.
                // COMPATIBILITY_MODE still permits the localhost loopback server for offline
                // audio transfer but blocks arbitrary HTTP resources in HTTPS pages.
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
            }
        }
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        if (bridge != null && bridge.getWebView() != null) {
            if (level >= TRIM_MEMORY_MODERATE) {
                // Free in-memory web caches without purging persistent IndexedDB/localStorage
                bridge.getWebView().clearCache(false);
            }
        }
    }

    @Override
    public void onLowMemory() {
        super.onLowMemory();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().clearCache(false);
        }
    }

    private void requestAppPermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        REQ_POST_NOTIFICATIONS
                );
            }
        }
    }
}

