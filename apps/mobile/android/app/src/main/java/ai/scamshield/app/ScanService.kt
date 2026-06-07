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

    // Path → last scanned timestamp; prevents the same file from being re-scanned within 1 hour
    private val recentlyScanned = LinkedHashMap<String, Long>(16, 0.75f, true)
    private fun alreadyScanned(path: String): Boolean {
        val now = System.currentTimeMillis()
        val last = recentlyScanned[path]
        if (last != null && now - last < 3_600_000L) return true
        recentlyScanned[path] = now
        if (recentlyScanned.size > 100) recentlyScanned.entries.removeIf { now - it.value > 3_600_000L }
        return false
    }

    // fileName → running ticker job so we can cancel it when verdict arrives
    private val notifTickers = mutableMapOf<String, kotlinx.coroutines.Job>()

    private fun startNotificationTicker(fileName: String) {
        notifTickers[fileName]?.cancel()
        notifTickers[fileName] = serviceScope.launch {
            var elapsed = 0
            while (true) {
                ScamNotificationManager.updateScanProgress(applicationContext, fileName, elapsed)
                kotlinx.coroutines.delay(1000)
                elapsed++
            }
        }
    }

    private fun cancelNotificationTicker(fileName: String) {
        notifTickers.remove(fileName)?.cancel()
    }

    override fun onCreate() {
        super.onCreate()
        ScamNotificationManager.createChannels(this)
        startForeground(NOTIF_ID, ScamNotificationManager.monitorNotification(this))
        startDownloadsObserver()
        Log.d(LOG_TAG, "ScanService started")
    }

    private fun startDownloadsObserver() {
        val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        downloadsObserver = makeFileObserver(dir) { event, path ->
            if (path == null) return@makeFileObserver
            val lowerPath = path.lowercase()
            if (!lowerPath.endsWith(".apk")) return@makeFileObserver

            val isPending = lowerPath.startsWith(".pending-")
            when {
                // Download just started — Chrome creates a .pending-*.apk temp file
                event and FileObserver.CREATE != 0 && isPending -> {
                    val cleanName = cleanApkFileName(path)
                    Log.d(LOG_TAG, "APK download started: $cleanName (raw=$path)")
                    ScamNotificationManager.showApkDownloadWarning(applicationContext, cleanName)
                    // Tick notification elapsed time from download start so users see progress
                    // even during slow downloads (overlay already has its own ticker)
                    startNotificationTicker(cleanName)
                }
                // Download complete — Chrome renames .pending-*.apk → final.apk (MOVED_TO)
                // Also catch direct CLOSE_WRITE in case some browsers skip the rename step
                (event and FileObserver.MOVED_TO != 0 || event and FileObserver.CLOSE_WRITE != 0) && !isPending -> {
                    val apkFile = File(dir, path)
                    if (alreadyScanned(apkFile.absolutePath)) return@makeFileObserver
                    val baseName = cleanApkFileName(path)
                    Log.d(LOG_TAG, "APK download complete ($event): ${apkFile.absolutePath}")
                    onApkComplete(apkFile, baseName)
                }
            }
        }.also { it.startWatching() }
        Log.d(LOG_TAG, "Watching downloads folder: ${dir.absolutePath}")
    }

    private fun onApkComplete(apkFile: File, baseName: String) {
        serviceScope.launch {
            kotlinx.coroutines.delay(800)
            // Ticker may already be running from download-start; ensure it is
            if (notifTickers[baseName] == null) startNotificationTicker(baseName)
            try {
                val signals = AppSignalCollector.collectFromApk(applicationContext, apkFile.absolutePath)
                    ?: AppSignals.minimal(baseName.toFakePackageId("download"), baseName, "sideloaded")
                val result = ScamApiClient.verify(signals)
                cancelNotificationTicker(baseName)
                ScamNotificationManager.showVerdict(
                    applicationContext, signals.appName, signals.packageId, result, signals.rawPermissions,
                    scanKey = baseName,
                )
            } catch (e: Exception) {
                cancelNotificationTicker(baseName)
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

/** Strips .pending-XXXXXXXX- prefix, Chrome duplicate-download suffix, and version suffix from download temp filenames. */
fun cleanApkFileName(raw: String): String {
    var name = raw.trimStart('.')
    if (name.startsWith("pending-")) {
        // "pending-1781377457-com.example.app_1.0" -> "com.example.app_1.0"
        name = name.substringAfter("-").substringAfter("-")
    }
    // Strip Chrome duplicate-download suffix: "filename_1.20.1 (5).apk" → "filename_1.20.1.apk"
    name = name.replace(Regex("\\s*\\(\\d+\\)(\\.apk)?$"), { m ->
        if (m.value.endsWith(".apk")) ".apk" else ""
    })
    // Strip trailing version like _1.20.1 or -1.20.1
    name = name.replace(Regex("[_-]\\d+(\\.\\d+)+$"), "")
    return name.removeSuffix(".apk")
}

@Suppress("DEPRECATION")
private fun makeFileObserver(dir: File, callback: (Int, String?) -> Unit): FileObserver =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        object : FileObserver(dir, CLOSE_WRITE or CREATE or MOVED_TO) {
            override fun onEvent(event: Int, path: String?) = callback(event, path)
        }
    } else {
        object : FileObserver(dir.absolutePath, CLOSE_WRITE or CREATE or MOVED_TO) {
            override fun onEvent(event: Int, path: String?) = callback(event, path)
        }
    }
