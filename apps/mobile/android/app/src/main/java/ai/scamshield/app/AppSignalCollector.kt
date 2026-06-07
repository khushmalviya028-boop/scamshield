package ai.scamshield.app

import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Log
import androidx.annotation.RequiresApi
import java.io.File
import java.security.MessageDigest

data class AppSignals(
    val packageId: String,
    val appName: String,
    val installerSource: String,
    val targetSdk: Int,
    val minSdk: Int,
    val certFingerprint: String,
    val requestsOverlay: Boolean,
    val requestsSms: Boolean,
    val requestsContacts: Boolean,
    val requestsCallLog: Boolean,
    val requestsCamera: Boolean,
    val requestsLocation: Boolean,
    val requestsExternalStorage: Boolean,
    val requestsAccessibility: Boolean,
    val requestsDeviceAdmin: Boolean,
    val dangerousPermissionCount: Int,
    val declaredServicesCount: Int,
    val rawPermissions: List<String> = emptyList(),
    val apkSizeBytes: Long? = null,
    val apkSha256: String? = null,
) {
    val isSideloaded: Boolean get() = installerSource == "sideloaded" || installerSource == "unknown"

    companion object {
        fun minimal(packageId: String, appName: String, installerSource: String) = AppSignals(
            packageId = packageId, appName = appName, installerSource = installerSource,
            targetSdk = 0, minSdk = 0, certFingerprint = "unknown",
            requestsOverlay = false, requestsSms = false, requestsContacts = false,
            requestsCallLog = false, requestsCamera = false, requestsLocation = false,
            requestsExternalStorage = false, requestsAccessibility = false,
            requestsDeviceAdmin = false, dangerousPermissionCount = 0, declaredServicesCount = 0,
        )
    }
}

object AppSignalCollector {

    private const val TAG = "ScamShield"

    fun collectFromApk(context: Context, apkFilePath: String): AppSignals? {
        val apkFile = File(apkFilePath)
        val pm = context.packageManager
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_PERMISSIONS or PackageManager.GET_SIGNING_CERTIFICATES or PackageManager.GET_SERVICES
        } else {
            @Suppress("DEPRECATION")
            PackageManager.GET_PERMISSIONS or PackageManager.GET_SIGNATURES or PackageManager.GET_SERVICES
        }
        if (apkFile.canRead()) return parseApk(pm, apkFilePath, apkFile, flags)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return parseViaMediaStore(context, pm, apkFile, flags)
        }
        Log.w(TAG, "Cannot read APK at $apkFilePath")
        return null
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    private fun parseViaMediaStore(context: Context, pm: PackageManager, apkFile: File, flags: Int): AppSignals? {
        val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL)
        val uri = context.contentResolver.query(
            collection,
            arrayOf(MediaStore.Downloads._ID),
            "${MediaStore.MediaColumns.DISPLAY_NAME} = ?",
            arrayOf(apkFile.name),
            null
        )?.use { cursor ->
            if (cursor.moveToFirst()) ContentUris.withAppendedId(collection, cursor.getLong(0)) else null
        } ?: run {
            Log.w(TAG, "APK not found in MediaStore: ${apkFile.name}")
            return null
        }
        return try {
            context.contentResolver.openFileDescriptor(uri, "r")?.use { pfd ->
                parseApk(pm, "/proc/self/fd/${pfd.fd}", apkFile, flags)
            }
        } catch (e: Exception) {
            Log.w(TAG, "MediaStore parse failed for ${apkFile.name}", e)
            null
        }
    }

    private fun parseApk(pm: PackageManager, readPath: String, originalFile: File, flags: Int): AppSignals? {
        return try {
            val info = pm.getPackageArchiveInfo(readPath, flags) ?: return null
            info.applicationInfo?.let {
                it.sourceDir = originalFile.absolutePath
                it.publicSourceDir = originalFile.absolutePath
            }
            val appInfo = info.applicationInfo ?: return null
            val packageName = info.packageName
            val appName = try { pm.getApplicationLabel(appInfo).toString() } catch (e: Exception) { packageName }
            val permissions = info.requestedPermissions?.toList() ?: emptyList()
            val permSet = permissions.toSet()
            AppSignals(
                packageId = packageName,
                appName = appName,
                installerSource = "sideloaded",
                targetSdk = appInfo.targetSdkVersion,
                minSdk = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) appInfo.minSdkVersion else 0,
                certFingerprint = getCertFingerprint(info),
                requestsOverlay = "android.permission.SYSTEM_ALERT_WINDOW" in permSet,
                requestsSms = "android.permission.READ_SMS" in permSet || "android.permission.RECEIVE_SMS" in permSet,
                requestsContacts = "android.permission.READ_CONTACTS" in permSet,
                requestsCallLog = "android.permission.READ_CALL_LOG" in permSet || "android.permission.PROCESS_OUTGOING_CALLS" in permSet,
                requestsCamera = "android.permission.CAMERA" in permSet,
                requestsLocation = "android.permission.ACCESS_FINE_LOCATION" in permSet || "android.permission.ACCESS_COARSE_LOCATION" in permSet,
                requestsExternalStorage = "android.permission.READ_EXTERNAL_STORAGE" in permSet || "android.permission.WRITE_EXTERNAL_STORAGE" in permSet,
                requestsAccessibility = "android.permission.BIND_ACCESSIBILITY_SERVICE" in permSet,
                requestsDeviceAdmin = "android.permission.BIND_DEVICE_ADMIN" in permSet,
                dangerousPermissionCount = countDangerousPermissions(permSet),
                declaredServicesCount = info.services?.size ?: 0,
                rawPermissions = permissions,
                apkSizeBytes = originalFile.takeIf { it.exists() }?.length(),
                apkSha256 = computeSha256(originalFile.absolutePath),
            )
        } catch (e: Exception) {
            Log.w(TAG, "Could not parse APK at $readPath", e)
            null
        }
    }

    fun collect(context: Context, packageName: String): AppSignals? {
        val pm = context.packageManager
        return try {
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageManager.GET_PERMISSIONS or PackageManager.GET_SIGNING_CERTIFICATES or PackageManager.GET_SERVICES
            } else {
                @Suppress("DEPRECATION")
                PackageManager.GET_PERMISSIONS or PackageManager.GET_SIGNATURES or PackageManager.GET_SERVICES
            }
            val info = pm.getPackageInfo(packageName, flags)
            val appInfo = info.applicationInfo ?: return null
            val appName = pm.getApplicationLabel(appInfo).toString()
            val installerSource = getInstallerSource(pm, packageName)
            val certFingerprint = getCertFingerprint(info)
            val permissions = info.requestedPermissions?.toSet() ?: emptySet()

            AppSignals(
                packageId = packageName,
                appName = appName,
                installerSource = installerSource,
                targetSdk = appInfo.targetSdkVersion,
                minSdk = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) appInfo.minSdkVersion else 0,
                certFingerprint = certFingerprint,
                requestsOverlay = "android.permission.SYSTEM_ALERT_WINDOW" in permissions,
                requestsSms = "android.permission.READ_SMS" in permissions || "android.permission.RECEIVE_SMS" in permissions,
                requestsContacts = "android.permission.READ_CONTACTS" in permissions,
                requestsCallLog = "android.permission.READ_CALL_LOG" in permissions || "android.permission.PROCESS_OUTGOING_CALLS" in permissions,
                requestsCamera = "android.permission.CAMERA" in permissions,
                requestsLocation = "android.permission.ACCESS_FINE_LOCATION" in permissions || "android.permission.ACCESS_COARSE_LOCATION" in permissions,
                requestsExternalStorage = "android.permission.READ_EXTERNAL_STORAGE" in permissions || "android.permission.WRITE_EXTERNAL_STORAGE" in permissions,
                requestsAccessibility = "android.permission.BIND_ACCESSIBILITY_SERVICE" in permissions,
                requestsDeviceAdmin = "android.permission.BIND_DEVICE_ADMIN" in permissions,
                dangerousPermissionCount = countDangerousPermissions(permissions),
                declaredServicesCount = info.services?.size ?: 0,
            )
        } catch (e: Exception) {
            Log.w(TAG, "Could not collect signals for $packageName", e)
            null
        }
    }

    private fun getInstallerSource(pm: PackageManager, packageName: String): String {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                pm.getInstallSourceInfo(packageName).installingPackageName ?: "unknown"
            } else {
                @Suppress("DEPRECATION")
                pm.getInstallerPackageName(packageName) ?: "unknown"
            }
        } catch (e: Exception) {
            "unknown"
        }
    }

    private fun getCertFingerprint(info: PackageInfo): String {
        return try {
            val cert = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                info.signingInfo?.apkContentsSigners?.firstOrNull()?.toByteArray()
            } else {
                @Suppress("DEPRECATION")
                info.signatures?.firstOrNull()?.toByteArray()
            } ?: return "unknown"
            MessageDigest.getInstance("SHA-256").digest(cert)
                .joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            "unknown"
        }
    }

    private fun computeSha256(path: String): String? {
        return try {
            val digest = MessageDigest.getInstance("SHA-256")
            java.io.File(path).inputStream().buffered(65536).use { stream ->
                val buf = ByteArray(65536)
                var read: Int
                while (stream.read(buf).also { read = it } != -1) {
                    digest.update(buf, 0, read)
                }
            }
            digest.digest().joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            null
        }
    }

    private val dangerousPermissions = setOf(
        "android.permission.READ_SMS",
        "android.permission.RECEIVE_SMS",
        "android.permission.SEND_SMS",
        "android.permission.READ_CONTACTS",
        "android.permission.WRITE_CONTACTS",
        "android.permission.READ_CALL_LOG",
        "android.permission.WRITE_CALL_LOG",
        "android.permission.PROCESS_OUTGOING_CALLS",
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.BIND_DEVICE_ADMIN",
        "android.permission.BIND_ACCESSIBILITY_SERVICE",
        "android.permission.REQUEST_INSTALL_PACKAGES",
        "android.permission.MANAGE_EXTERNAL_STORAGE",
        "android.permission.PACKAGE_USAGE_STATS",
    )

    private fun countDangerousPermissions(permissions: Set<String>) =
        permissions.count { it in dangerousPermissions }
}
