package ai.scamshield.app
import expo.modules.splashscreen.SplashScreenManager

import android.Manifest
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {

  companion object {
    private const val REQ_NOTIFICATIONS = 1001
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    intent?.getStringExtra("packageId")?.let { Log.d(LOG_TAG, "Opened from notification for: $it") }
    if (BuildConfig.DEBUG) intent?.getStringExtra("debug_scan")?.let { triggerTestScan(it) }
  }

  private fun triggerTestScan(packageId: String) {
    val appName = when (packageId) {
      "com.quickrupee.instantloan" -> "QuickRupee - Instant Loan"
      "com.hdfc.mobilebanking"     -> "HDFC Bank"
      else -> packageId.split(".").last().replaceFirstChar { it.uppercase() }
    }
    val ctx = applicationContext
    ScamNotificationManager.showChecking(ctx, appName, packageId)
    AppScope.launch {
      try {
        val result = ScamApiClient.verify(AppSignals.minimal(packageId, appName, "debug"))
        ScamNotificationManager.showVerdict(ctx, appName, packageId, result)
      } catch (e: Exception) {
        ScamNotificationManager.showError(ctx, appName, packageId)
      }
    }
  }

  // ── Permissions ────────────────────────────────────────────────────────────

  private fun requestNotificationPermission() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
        == PackageManager.PERMISSION_GRANTED) return
    ActivityCompat.requestPermissions(
      this,
      arrayOf(Manifest.permission.POST_NOTIFICATIONS),
      REQ_NOTIFICATIONS,
    )
  }

  override fun onRequestPermissionsResult(
    requestCode: Int, permissions: Array<String>, grantResults: IntArray
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == REQ_NOTIFICATIONS &&
        grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
      Log.d("ScamShield", "Notification permission granted")
      promptAccessibilityOnce()
    }
  }

  // ── Accessibility onboarding ────────────────────────────────────────────────

  private fun isAccessibilityServiceEnabled(): Boolean {
    val service = "$packageName/${PlayStoreAccessibilityService::class.java.canonicalName}"
    val enabledServices = Settings.Secure.getString(
      contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    ) ?: return false
    return enabledServices.split(":").any { it.equals(service, ignoreCase = true) }
  }

  private fun promptAccessibilityOnce() {
    if (isAccessibilityServiceEnabled()) return
    val prefs = getSharedPreferences("scamshield", MODE_PRIVATE)
    if (prefs.getBoolean("accessibility_prompted", false)) return
    prefs.edit().putBoolean("accessibility_prompted", true).apply()

    AlertDialog.Builder(this)
      .setTitle("Enable Play Store Protection")
      .setMessage(
        "ScamShield can warn you before you install a risky app from the Play Store.\n\n" +
        "On the next screen: find \"ScamShield Play Store Monitor\" and turn it ON."
      )
      .setPositiveButton("Enable Protection") { _, _ ->
        startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
      }
      .setNegativeButton("Not Now", null)
      .setCancelable(false)
      .show()
  }

  // ── All-files access (MANAGE_EXTERNAL_STORAGE) ─────────────────────────────

  private fun promptAllFilesAccess() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
    if (Environment.isExternalStorageManager()) return
    val prefs = getSharedPreferences("scamshield", MODE_PRIVATE)
    if (prefs.getBoolean("all_files_prompted", false)) return
    prefs.edit().putBoolean("all_files_prompted", true).apply()
    AlertDialog.Builder(this)
      .setTitle("Allow APK File Scanning")
      .setMessage(
        "ScamShield needs \"All files access\" to read APK files you download and check their permissions for malware, spyware, and predatory loan app behaviour.\n\n" +
        "Without this, ScamShield cannot scan apps downloaded outside the Play Store."
      )
      .setPositiveButton("Grant Access") { _, _ ->
        startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
          data = android.net.Uri.parse("package:$packageName")
        })
      }
      .setNegativeButton("Skip", null)
      .setCancelable(false)
      .show()
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  override fun onCreate(savedInstanceState: Bundle?) {
    SplashScreenManager.registerOnActivity(this)
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    // @generated end expo-splashscreen
    super.onCreate(null)
    if (BuildConfig.DEBUG) intent?.getStringExtra("debug_scan")?.let { triggerTestScan(it) }
    requestNotificationPermission()
    promptAllFilesAccess()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      // On older Android, notifications don't need a runtime grant — go straight to accessibility prompt
      promptAccessibilityOnce()
    }
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              super.invokeDefaultOnBackPressed()
          }
          return
      }
      super.invokeDefaultOnBackPressed()
  }
}
