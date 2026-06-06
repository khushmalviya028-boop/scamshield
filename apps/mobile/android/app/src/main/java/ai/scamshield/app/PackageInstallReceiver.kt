package ai.scamshield.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import kotlinx.coroutines.launch

class PackageInstallReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED -> {
                ScanService.start(context)
            }

            Intent.ACTION_PACKAGE_ADDED -> {
                val packageName = intent.data?.schemeSpecificPart ?: return
                val isReplacing = intent.getBooleanExtra(Intent.EXTRA_REPLACING, false)
                // Skip updates to existing apps — only check fresh installs
                if (isReplacing) return

                Log.d(LOG_TAG, "New package installed: $packageName")
                scanPackage(context, packageName)
            }
        }
    }

    private fun scanPackage(context: Context, packageName: String) {
        val signals = AppSignalCollector.collect(context, packageName)
        val appName = signals?.appName ?: packageName
        ScamNotificationManager.showChecking(context, appName, packageName)

        AppScope.launch {
            try {
                val result = if (signals != null) {
                    ScamApiClient.verify(signals)
                } else {
                    ScamApiClient.verify(AppSignals.minimal(packageName, appName, "unknown"))
                }
                ScamNotificationManager.showVerdict(context, appName, packageName, result, signals?.rawPermissions ?: emptyList())
            } catch (e: Exception) {
                Log.e(LOG_TAG, "Scan failed for $packageName", e)
                ScamNotificationManager.showError(context, appName, packageName)
            }
        }
    }
}
