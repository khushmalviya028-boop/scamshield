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

    private fun Context.nm() =
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    fun createChannels(context: Context) {
        context.nm().createNotificationChannel(
            NotificationChannel(CHANNEL_MONITOR, "ScamShield Monitor", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Persistent monitor status"
                setShowBadge(false)
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

    /** Called when scan starts — shows a brief scanning overlay (no-op, scan is fast). */
    fun showChecking(context: Context, appName: String, packageId: String) {
        // Intentionally lightweight — the full overlay fires on verdict
    }

    /**
     * Shows a full-screen overlay popup with risk, score, permissions and action buttons.
     * This fires over any app the user is in — no notification centre required.
     */
    fun showVerdict(
        context: Context,
        appName: String,
        packageId: String,
        result: ScanResult,
        permissions: List<String> = emptyList(),
    ) {
        VerdictOverlayActivity.launch(context, appName, packageId, result, permissions)
    }

    fun showError(context: Context, appName: String, packageId: String) {
        // Silently skip — a failed scan shouldn't alarm the user unnecessarily
    }

    fun showApkDownloadWarning(context: Context, fileName: String) {
        // APK download warning fires immediately — show a brief overlay
        val warning = ScanResult(
            appName = fileName,
            packageId = "",
            score = 50,
            band = RiskBand.CAUTION,
            verdictLabel = "APK from outside Play Store",
            recommendedAction = "This APK was downloaded directly — not from the Play Store. " +
                "ScamShield is scanning it now. Do NOT install until the result appears.",
        )
        VerdictOverlayActivity.launch(context, fileName, "", warning)
    }

    fun showPreInstallCheck(context: Context, appName: String) {
        // Pre-install check — no overlay needed, verdict fires when ready
    }

    private fun notifId(packageId: String) = packageId.hashCode()
}
