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

    private const val CHANNEL_VERDICT = "scamshield_verdict"
    private const val CHANNEL_MONITOR = "scamshield_monitor"

    private fun Context.nm() =
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    fun createChannels(context: Context) {
        val nm = context.nm()
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_VERDICT, "App Scan Verdicts", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Alerts when a newly installed app is analysed"
                enableLights(true); lightColor = Color.RED; enableVibration(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
        )
        nm.createNotificationChannel(
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

    fun showChecking(context: Context, appName: String, packageId: String) {
        context.nm().notify(notifId(packageId),
            NotificationCompat.Builder(context, CHANNEL_VERDICT)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Scanning: $appName")
                .setContentText("Checking if this app is safe…")
                .setProgress(0, 0, true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(false)
                .build()
        )
    }

    fun showVerdict(context: Context, appName: String, packageId: String, result: ScanResult) {
        val (emoji, colorHex, bigText) = when (result.band) {
            RiskBand.HIGH_RISK -> Triple("🚨", Color.rgb(239, 68, 68),
                "${result.recommendedAction}\n\nScore: ${result.score}/100")
            RiskBand.CAUTION   -> Triple("⚠️", Color.rgb(245, 158, 11),
                "${result.recommendedAction}\n\nScore: ${result.score}/100")
            RiskBand.SAFE      -> Triple("✅", Color.rgb(34, 197, 94),
                "${result.recommendedAction}\n\nScore: ${result.score}/100")
        }
        val openIntent = PendingIntent.getActivity(
            context, notifId(packageId),
            Intent(context, MainActivity::class.java).apply {
                putExtra("packageId", packageId); putExtra("appName", appName)
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        context.nm().notify(notifId(packageId),
            NotificationCompat.Builder(context, CHANNEL_VERDICT)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("$emoji $appName — ${result.verdictLabel}")
                .setContentText(result.recommendedAction)
                .setStyle(NotificationCompat.BigTextStyle().bigText(bigText))
                .setColor(colorHex)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(openIntent)
                .setAutoCancel(true)
                .build()
        )
    }

    fun showError(context: Context, appName: String, packageId: String) {
        context.nm().notify(notifId(packageId),
            NotificationCompat.Builder(context, CHANNEL_VERDICT)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("⚠️ $appName — Scan incomplete")
                .setContentText("Could not verify this app. Proceed with caution.")
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .build()
        )
    }

    fun showApkDownloadWarning(context: Context, fileName: String) {
        context.nm().notify(notifId("apk:$fileName"),
            NotificationCompat.Builder(context, CHANNEL_VERDICT)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("⚠️ APK downloaded: $fileName")
                .setContentText("This app is from outside Play Store. Scanning for risks…")
                .setStyle(NotificationCompat.BigTextStyle().bigText(
                    "This APK was downloaded directly and is not from the Play Store. " +
                    "ScamShield is scanning it now — do not install until the result is shown."
                ))
                .setColor(Color.rgb(245, 158, 11))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(false)
                .build()
        )
    }

    fun showPreInstallCheck(context: Context, appName: String) {
        context.nm().notify(notifId("preinstall:$appName"),
            NotificationCompat.Builder(context, CHANNEL_VERDICT)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Checking: $appName")
                .setContentText("ScamShield is verifying this app before you install…")
                .setProgress(0, 0, true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(false)
                .build()
        )
    }

    private fun notifId(packageId: String) = packageId.hashCode()
}
