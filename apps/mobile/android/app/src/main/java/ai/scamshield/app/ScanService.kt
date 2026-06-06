package ai.scamshield.app

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.os.FileObserver
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.io.File

class ScanService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var downloadsObserver: FileObserver? = null

    override fun onCreate() {
        super.onCreate()
        ScamNotificationManager.createChannels(this)
        startForeground(NOTIF_ID, ScamNotificationManager.monitorNotification(this))
        startDownloadsObserver()
        Log.d(LOG_TAG, "ScanService started")
    }

    private fun startDownloadsObserver() {
        val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        downloadsObserver = makeFileObserver(dir) { path ->
            if (path != null && path.endsWith(".apk", ignoreCase = true)) onApkDetected(path)
        }.also { it.startWatching() }
        Log.d(LOG_TAG, "Watching downloads folder: ${dir.absolutePath}")
    }

    private fun onApkDetected(fileName: String) {
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val apkFile = File(downloadsDir, fileName)
        val baseName = apkFile.nameWithoutExtension
        Log.d(LOG_TAG, "APK detected: ${apkFile.absolutePath}")
        ScamNotificationManager.showApkDownloadWarning(applicationContext, baseName)
        serviceScope.launch {
            try {
                val signals = AppSignalCollector.collectFromApk(applicationContext, apkFile.absolutePath)
                    ?: AppSignals.minimal(baseName.toFakePackageId("download"), baseName, "sideloaded")
                val result = ScamApiClient.verify(signals)
                ScamNotificationManager.showVerdict(applicationContext, signals.appName, signals.packageId, result, signals.rawPermissions)
            } catch (e: Exception) {
                Log.e(LOG_TAG, "Scan failed for APK: ${apkFile.absolutePath}", e)
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        downloadsObserver?.stopWatching()
        serviceScope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val NOTIF_ID = 9001
        fun start(context: Context) =
            context.startForegroundService(Intent(context, ScanService::class.java))
        fun stop(context: Context) =
            context.stopService(Intent(context, ScanService::class.java))
    }
}

@Suppress("DEPRECATION")
private fun makeFileObserver(dir: File, callback: (String?) -> Unit): FileObserver =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        object : FileObserver(dir, CLOSE_WRITE or CREATE) {
            override fun onEvent(event: Int, path: String?) = callback(path)
        }
    } else {
        object : FileObserver(dir.absolutePath, CLOSE_WRITE or CREATE) {
            override fun onEvent(event: Int, path: String?) = callback(path)
        }
    }
