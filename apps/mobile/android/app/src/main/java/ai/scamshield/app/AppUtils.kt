package ai.scamshield.app

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

const val LOG_TAG = "ScamShield"

val PACKAGE_SLUG_REGEX = Regex("[^a-z0-9.]")

fun String.toFakePackageId(prefix: String) =
    "$prefix.${lowercase().replace(" ", ".").replace(PACKAGE_SLUG_REGEX, "")}"

/** Process-wide IO scope — never cancelled, mirrors application lifetime. */
val AppScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

enum class RiskBand {
    HIGH_RISK, CAUTION, SAFE;

    companion object {
        fun from(value: String) = when (value.lowercase().replace("_", "-")) {
            "high-risk" -> HIGH_RISK
            "caution"   -> CAUTION
            else        -> SAFE
        }
    }
}
