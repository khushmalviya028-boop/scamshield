package ai.scamshield.app

import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

enum class PlayStoreStatus { ON_STORE, NOT_ON_STORE, SIDELOADED_CLONE, UNKNOWN }

data class ScanResult(
    val appName: String,
    val packageId: String,
    val score: Int,
    val band: RiskBand,
    val verdictLabel: String,
    val recommendedAction: String,
    val isSideloaded: Boolean = false,
    val playStoreStatus: PlayStoreStatus = PlayStoreStatus.UNKNOWN,
    val gate: String = "na",
    val gateBanner: String = "",
    val gateDetails: String = "",
)

object ScamApiClient {

    private val API_URL = if (BuildConfig.DEBUG) "http://10.0.2.2:3001" else "https://api.scamshield.ai"

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    fun verify(signals: AppSignals): ScanResult {
        val request = Request.Builder()
            .url("$API_URL/api/verify")
            .post(buildPayload(signals).toString().toRequestBody("application/json".toMediaType()))
            .header("User-Agent", "ScamShield-Android/1.0")
            .build()

        return try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val wrapper = JSONObject(response.body?.string() ?: "{}")
                    val json = wrapper.optJSONObject("result") ?: wrapper
                    val firedIds = buildSet {
                        val arr = json.optJSONArray("firedSignals")
                        if (arr != null) for (i in 0 until arr.length()) {
                            add(arr.getJSONObject(i).optString("id"))
                        }
                    }
                    val psStatus = when {
                        !signals.isSideloaded -> PlayStoreStatus.ON_STORE
                        "sideloaded_not_in_store" in firedIds -> PlayStoreStatus.NOT_ON_STORE
                        "sideloaded_impersonates_known_app" in firedIds -> PlayStoreStatus.SIDELOADED_CLONE
                        else -> PlayStoreStatus.UNKNOWN
                    }
                    ScanResult(
                        appName = json.optString("appName", signals.appName),
                        packageId = signals.packageId,
                        score = json.optInt("score", 50),
                        band = RiskBand.from(json.optString("band", "caution")),
                        verdictLabel = json.optString("verdictLabel", "Unknown"),
                        recommendedAction = json.optString("recommendedAction", "Proceed with caution."),
                        isSideloaded = signals.isSideloaded,
                        playStoreStatus = psStatus,
                        gate = json.optString("gate", "na"),
                        gateBanner = json.optString("gateBanner", ""),
                        gateDetails = json.optString("gateDetails", ""),
                    )
                } else {
                    Log.w(LOG_TAG, "API returned ${response.code} for ${signals.packageId}")
                    offlineFallback(signals)
                }
            }
        } catch (e: Exception) {
            Log.w(LOG_TAG, "API unreachable, using offline fallback for ${signals.packageId}")
            offlineFallback(signals)
        }
    }

    private fun buildPayload(signals: AppSignals) = JSONObject().apply {
        put("packageId", signals.packageId)
        put("appName", signals.appName)
        put("isSideloaded", signals.isSideloaded)
        put("isFinanceApp", detectFinanceApp(signals.packageId, signals.appName))
        if (signals.rawPermissions.isNotEmpty()) {
            val arr = JSONArray()
            signals.rawPermissions.forEach { arr.put(it) }
            put("permissions", arr)
        }
        signals.apkSizeBytes?.let { put("apkSizeBytes", it) }
        signals.apkSha256?.let { put("apkSha256", it) }
    }

    private fun detectFinanceApp(packageId: String, appName: String): Boolean {
        val financeKeywords = listOf(
            "loan", "credit", "paisa", "rupee", "cash", "lend", "finance",
            "bank", "wallet", "money", "borrow", "emi", "advance", "instant",
        )
        val combined = (packageId + " " + appName).lowercase()
        return financeKeywords.count { combined.contains(it) } >= 2
    }

    private fun offlineFallback(signals: AppSignals): ScanResult {
        val risk = computeOfflineRisk(signals)
        // Sideloaded APKs are never SAFE — minimum band is CAUTION
        val isSideloaded = signals.installerSource == "sideloaded" || signals.installerSource == "unknown" || signals.installerSource.isEmpty()
        val effectiveRisk = if (isSideloaded) risk.coerceAtLeast(40) else risk
        return when {
            effectiveRisk >= 70 -> ScanResult(
                signals.appName, signals.packageId, effectiveRisk, RiskBand.HIGH_RISK,
                "HIGH RISK",
                "This app shows multiple high-risk signals. Do not grant it access to contacts, messages, or financial data.",
                isSideloaded = isSideloaded,
            )
            effectiveRisk >= 40 -> ScanResult(
                signals.appName, signals.packageId, effectiveRisk, RiskBand.CAUTION,
                "VERIFY CAREFULLY",
                "This APK was downloaded outside the Play Store and could not be fully verified. Do not install until you have confirmed it is safe.",
                isSideloaded = isSideloaded,
            )
            else -> ScanResult(
                signals.appName, signals.packageId, effectiveRisk, RiskBand.SAFE,
                "LOW RISK",
                "No major risk signals detected offline. Full verification requires internet.",
                isSideloaded = isSideloaded,
            )
        }
    }

    private fun computeOfflineRisk(s: AppSignals): Int {
        var risk = 0
        val isSideloaded = s.installerSource == "sideloaded" || s.installerSource == "unknown" || s.installerSource.isEmpty()
        if (isSideloaded) risk += 30
        if (s.requestsSms && s.requestsContacts) risk += 20
        if (s.requestsCallLog) risk += 10
        if (s.requestsOverlay) risk += 15
        if (s.requestsDeviceAdmin) risk += 25
        if (s.requestsAccessibility) risk += 40
        if (s.dangerousPermissionCount > 8) risk += 10
        if (s.targetSdk in 1..25) risk += 10  // targetSdk 0 means unknown (minimal signals)
        return risk.coerceIn(0, 100)
    }
}
