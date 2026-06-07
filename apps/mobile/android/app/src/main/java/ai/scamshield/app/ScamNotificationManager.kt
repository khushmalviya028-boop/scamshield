package ai.scamshield.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import androidx.core.app.NotificationCompat

object ScamNotificationManager {

    private const val CHANNEL_MONITOR = "scamshield_monitor"
    private const val CHANNEL_ALERT   = "scamshield_alert"
    private const val NOTIF_SCAN_BASE  = 8000

    private fun Context.nm() =
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    fun createChannels(context: Context) {
        context.nm().createNotificationChannel(
            NotificationChannel(CHANNEL_MONITOR, "ScamShield Monitor", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Persistent monitor status"
                setShowBadge(false)
            }
        )
        context.nm().createNotificationChannel(
            NotificationChannel(CHANNEL_ALERT, "ScamShield Alerts", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Scam APK download and verdict alerts"
                enableLights(true)
                lightColor = Color.RED
                enableVibration(true)
            }
        )
    }

    fun monitorNotification(context: Context): Notification {
        val openIntent = PendingIntent.getActivity(
            context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(context, CHANNEL_MONITOR)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("ScamShield Active")
            .setContentText("Monitoring new app installs for scams")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openIntent)
            .build()
    }

    fun showChecking(context: Context, appName: String, packageId: String) {}

    fun showVerdict(
        context: Context,
        appName: String,
        packageId: String,
        result: ScanResult,
        permissions: List<String> = emptyList(),
        scanKey: String = "",
    ) {
        // Cancel the scanning notification
        if (scanKey.isNotEmpty()) context.nm().cancel(scanKey.hashCode() + NOTIF_SCAN_BASE)
        context.nm().cancel(packageId.hashCode() + NOTIF_SCAN_BASE)
        context.nm().cancel(appName.hashCode() + NOTIF_SCAN_BASE)

        val overlayIntent = VerdictOverlayActivity.buildIntent(context, appName, packageId, result, permissions, isScanning = false)

        // Launch overlay directly — SYSTEM_ALERT_WINDOW lets us start activities from the
        // background service; FLAG_TURN_SCREEN_ON + FLAG_SHOW_WHEN_LOCKED in the activity
        // handle the screen-off / lock-screen case, so no heads-up notification is needed.
        try {
            context.startActivity(overlayIntent)
        } catch (_: Exception) {
            // Fallback: post a coloured notification if direct launch is blocked
            val pi = PendingIntent.getActivity(
                context, packageId.hashCode(),
                overlayIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            val accentColor = when (result.band) {
                RiskBand.HIGH_RISK -> Color.rgb(220, 20, 20)
                RiskBand.CAUTION   -> Color.rgb(220, 130, 0)
                else               -> Color.rgb(30, 160, 60)
            }
            val notif = NotificationCompat.Builder(context, CHANNEL_ALERT)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("ScamShield: ${result.verdictLabel}")
                .setContentText("$appName — tap to see full report")
                .setColor(accentColor)
                .setColorized(result.band == RiskBand.HIGH_RISK)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setFullScreenIntent(pi, true)
                .setContentIntent(pi)
                .build()
            context.nm().notify(packageId.hashCode(), notif)
        }
    }

    fun showError(context: Context, appName: String, packageId: String) {}

    fun showApkDownloadWarning(context: Context, fileName: String) {
        val overlayIntent = VerdictOverlayActivity.buildScanningIntent(context, fileName)
        val pi = PendingIntent.getActivity(
            context, fileName.hashCode(),
            overlayIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        val notif = buildScanProgressNotif(context, fileName, elapsedSeconds = 0, pi)
        context.nm().notify(fileName.hashCode() + NOTIF_SCAN_BASE, notif)
        try { context.startActivity(overlayIntent) } catch (_: Exception) {}
    }

    fun updateScanProgress(context: Context, fileName: String, elapsedSeconds: Int) {
        val pi = PendingIntent.getActivity(
            context, fileName.hashCode(),
            VerdictOverlayActivity.buildScanningIntent(context, fileName),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        context.nm().notify(
            fileName.hashCode() + NOTIF_SCAN_BASE,
            buildScanProgressNotif(context, fileName, elapsedSeconds, pi),
        )
    }

    private fun buildScanProgressNotif(
        context: Context, fileName: String, elapsedSeconds: Int, pi: PendingIntent
    ): android.app.Notification {
        val subtitle = if (elapsedSeconds == 0) "Checking permissions · RBI registry · malware database"
                       else "Checking permissions · RBI registry · malware database — ${elapsedSeconds}s"
        return NotificationCompat.Builder(context, CHANNEL_ALERT)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("🔍 Scanning $fileName")
            .setContentText(subtitle)
            .setStyle(NotificationCompat.BigTextStyle().bigText(subtitle))
            .setProgress(0, 0, true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setAutoCancel(false)
            .setFullScreenIntent(pi, true)
            .setContentIntent(pi)
            .build()
    }

    fun showPreInstallCheck(context: Context, appName: String) {}
}
