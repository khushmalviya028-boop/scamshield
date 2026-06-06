package ai.scamshield.app

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import kotlinx.coroutines.launch

/**
 * Fallback for DownloadManager-initiated downloads (e.g. from apps that use the system
 * DownloadManager API directly). The primary APK detection path is the FileObserver in
 * ScanService, which catches any APK dropped into the Downloads folder by any browser.
 */
class DownloadReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
        val downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
        if (downloadId == -1L) return

        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val cursor = dm.query(DownloadManager.Query().setFilterById(downloadId)) ?: return
        if (!cursor.moveToFirst()) { cursor.close(); return }

        val uriCol = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI)
        val titleCol = cursor.getColumnIndex(DownloadManager.COLUMN_TITLE)
        val mimeCol = cursor.getColumnIndex(DownloadManager.COLUMN_MEDIA_TYPE)
        val localUri = if (uriCol >= 0) cursor.getString(uriCol) ?: "" else ""
        val title = if (titleCol >= 0) cursor.getString(titleCol) ?: "Unknown" else "Unknown"
        val mimeType = if (mimeCol >= 0) cursor.getString(mimeCol) ?: "" else ""
        cursor.close()

        val isApk = mimeType == "application/vnd.android.package-archive" ||
                localUri.endsWith(".apk", ignoreCase = true) ||
                title.endsWith(".apk", ignoreCase = true)
        if (!isApk) return

        val fileName = title.removeSuffix(".apk").trim()
        Log.d(LOG_TAG, "APK via DownloadManager: $fileName (uri=$localUri)")

        // Resolve the real file path from the file:// URI
        val apkPath = try {
            if (localUri.startsWith("file://")) java.net.URI(localUri).path else localUri
        } catch (e: Exception) { localUri }

        ScamNotificationManager.showApkDownloadWarning(context, fileName)
        AppScope.launch {
            try {
                val signals = AppSignalCollector.collectFromApk(context, apkPath)
                    ?: AppSignals.minimal(fileName.toFakePackageId("download"), fileName, "sideloaded")
                val result = ScamApiClient.verify(signals)
                ScamNotificationManager.showVerdict(context, signals.appName, signals.packageId, result, signals.rawPermissions)
            } catch (e: Exception) {
                Log.e(LOG_TAG, "Scan failed for DownloadManager APK", e)
            }
        }
    }
}
