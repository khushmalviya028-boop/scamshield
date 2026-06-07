package ai.scamshield.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.*

class VerdictOverlayActivity : Activity() {

    companion object {
        private const val EXTRA_APP_NAME      = "app_name"
        private const val EXTRA_PKG_ID        = "pkg_id"
        private const val EXTRA_SCORE         = "score"
        private const val EXTRA_BAND          = "band"
        private const val EXTRA_VERDICT       = "verdict"
        private const val EXTRA_ACTION        = "action"
        private const val EXTRA_PERMISSIONS   = "permissions"
        private const val EXTRA_IS_SCANNING   = "is_scanning"
        private const val EXTRA_IS_SIDELOADED = "is_sideloaded"
        private const val EXTRA_PS_STATUS     = "ps_status"
        private const val EXTRA_GATE          = "gate"
        private const val EXTRA_GATE_BANNER   = "gate_banner"
        private const val EXTRA_GATE_DETAILS  = "gate_details"

        fun buildIntent(
            context: Context,
            appName: String,
            packageId: String,
            result: ScanResult,
            permissions: List<String> = emptyList(),
            isScanning: Boolean = false,
        ): Intent = Intent(context, VerdictOverlayActivity::class.java).apply {
            putExtra(EXTRA_APP_NAME, appName)
            putExtra(EXTRA_PKG_ID, packageId)
            putExtra(EXTRA_SCORE, result.score)
            putExtra(EXTRA_BAND, result.band.name)
            putExtra(EXTRA_VERDICT, result.verdictLabel)
            putExtra(EXTRA_ACTION, result.recommendedAction)
            putStringArrayListExtra(EXTRA_PERMISSIONS, ArrayList(permissions.take(12)))
            putExtra(EXTRA_IS_SCANNING, isScanning)
            putExtra(EXTRA_IS_SIDELOADED, result.isSideloaded)
            putExtra(EXTRA_PS_STATUS, result.playStoreStatus.name)
            putExtra(EXTRA_GATE, result.gate)
            putExtra(EXTRA_GATE_BANNER, result.gateBanner)
            putExtra(EXTRA_GATE_DETAILS, result.gateDetails)
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_NO_HISTORY or
                Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
            )
        }

        fun buildScanningIntent(context: Context, fileName: String): Intent =
            Intent(context, VerdictOverlayActivity::class.java).apply {
                putExtra(EXTRA_APP_NAME, fileName)
                putExtra(EXTRA_PKG_ID, "")
                putExtra(EXTRA_IS_SCANNING, true)
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_NO_HISTORY or
                    Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
                )
            }

        // Keep old launch() for callers that don't use notifications
        fun launch(
            context: Context,
            appName: String,
            packageId: String,
            result: ScanResult,
            permissions: List<String> = emptyList(),
        ) = context.startActivity(buildIntent(context, appName, packageId, result, permissions, isScanning = false))
    }

    private var tickerHandler: android.os.Handler? = null
    private var tickerRunnable: Runnable? = null

    override fun onDestroy() {
        tickerRunnable?.let { tickerHandler?.removeCallbacks(it) }
        super.onDestroy()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val appName    = intent.getStringExtra(EXTRA_APP_NAME) ?: "Unknown App"
        val packageId  = intent.getStringExtra(EXTRA_PKG_ID) ?: ""
        val isScanning = intent.getBooleanExtra(EXTRA_IS_SCANNING, false)

        val dp = resources.displayMetrics.density
        fun Int.dp() = (this * dp).toInt()

        val root = ScrollView(this).apply {
            setBackgroundColor(0xEE0A0A0A.toInt())
        }
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(20.dp(), 32.dp(), 20.dp(), 24.dp())
        }
        root.addView(card)

        if (isScanning) {
            buildScanningUI(card, appName, packageId, dp)
        } else {
            buildVerdictUI(card, appName, packageId, dp)
        }

        setContentView(root)
    }

    // ── SCANNING MODE ─────────────────────────────────────────────────────────

    private fun buildScanningUI(card: LinearLayout, appName: String, packageId: String, dp: Float) {
        fun Int.dp() = (this * dp).toInt()

        val orange = Color.rgb(251, 146, 60)
        val red    = Color.rgb(239, 68, 68)

        // Header row
        card.addView(LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, 16.dp())
            addView(TextView(this@VerdictOverlayActivity).apply {
                text = "⚠️"
                textSize = 32f
                setPadding(0, 0, 12.dp(), 0)
            })
            addView(LinearLayout(this@VerdictOverlayActivity).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(this@VerdictOverlayActivity).apply {
                    text = "APK DOWNLOAD INTERCEPTED"
                    setTextColor(orange)
                    textSize = 14f
                    typeface = Typeface.DEFAULT_BOLD
                    letterSpacing = 0.05f
                })
                addView(TextView(this@VerdictOverlayActivity).apply {
                    text = "ScamShield is analyzing this file"
                    setTextColor(Color.argb(160, 255, 255, 255))
                    textSize = 12f
                })
            })
        })

        // Divider
        card.addView(divider(dp))

        // App/file name
        card.addView(TextView(this).apply {
            text = appName
            setTextColor(Color.WHITE)
            textSize = 20f
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, 16.dp(), 0, 4.dp())
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.MIDDLE
        })

        // "NOT FROM PLAY STORE" badge
        card.addView(TextView(this).apply {
            text = "⛔  NOT FROM GOOGLE PLAY STORE"
            setTextColor(red)
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
            letterSpacing = 0.06f
            setBackgroundColor(Color.argb(30, 239, 68, 68))
            setPadding(10.dp(), 5.dp(), 10.dp(), 5.dp())
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 4.dp()
            lp.bottomMargin = 20.dp()
            layoutParams = lp
        })

        // Divider
        card.addView(divider(dp))

        // Why dangerous section
        card.addView(TextView(this).apply {
            text = "WHY THIS IS DANGEROUS"
            setTextColor(Color.argb(140, 255, 255, 255))
            textSize = 10f
            letterSpacing = 0.12f
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, 16.dp(), 0, 12.dp())
        })

        val risks = listOf(
            "📋" to "Reads your contacts & uploads them to scam operators",
            "💬" to "Intercepts your SMS and steals OTPs / bank passwords",
            "📷" to "Captures photos silently — used for sextortion blackmail",
            "🔐" to "Locks your phone and demands ransom to restore access",
            "🎧" to "Records calls without permission",
            "📍" to "Tracks your real-time location",
            "🔄" to "Installs additional malware in background",
            "🚫" to "Prevents its own uninstallation via Device Admin rights",
        )
        risks.forEach { (icon, text) ->
            card.addView(LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.TOP
                setPadding(0, 4.dp(), 0, 4.dp())
                addView(TextView(this@VerdictOverlayActivity).apply {
                    this.text = icon
                    textSize = 14f
                    setPadding(0, 0, 10.dp(), 0)
                })
                addView(TextView(this@VerdictOverlayActivity).apply {
                    this.text = text
                    setTextColor(Color.argb(200, 255, 255, 255))
                    textSize = 13f
                    setLineSpacing(0f, 1.25f)
                })
            })
        }

        // Divider
        card.addView(divider(dp).apply {
            val lp = layoutParams as LinearLayout.LayoutParams
            lp.topMargin = 16.dp()
            layoutParams = lp
        })

        // Scanning status with live elapsed timer
        val elapsedLabel = TextView(this@VerdictOverlayActivity).apply {
            text = "Checking permissions · RBI registry · malware database"
            setTextColor(Color.argb(160, 255, 255, 255))
            textSize = 11f
            setPadding(0, 2.dp(), 0, 0)
        }
        card.addView(LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 16.dp(), 0, 8.dp())
            addView(TextView(this@VerdictOverlayActivity).apply {
                text = "🔍"
                textSize = 20f
                setPadding(0, 0, 10.dp(), 0)
            })
            addView(LinearLayout(this@VerdictOverlayActivity).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(this@VerdictOverlayActivity).apply {
                    text = "SCANNING IN PROGRESS"
                    setTextColor(orange)
                    textSize = 12f
                    typeface = Typeface.DEFAULT_BOLD
                    letterSpacing = 0.06f
                })
                addView(elapsedLabel)
            })
        })

        // Indeterminate progress bar
        card.addView(android.widget.ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = true
            indeterminateTintList = android.content.res.ColorStateList.valueOf(orange)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 6.dp())
            lp.topMargin = 4.dp()
            lp.bottomMargin = 4.dp()
            layoutParams = lp
        })

        // Start elapsed-time ticker
        var elapsed = 0
        tickerHandler = android.os.Handler(android.os.Looper.getMainLooper())
        val ticker = object : Runnable {
            override fun run() {
                elapsed++
                elapsedLabel.text = "Checking permissions · RBI registry · malware database — ${elapsed}s"
                tickerHandler?.postDelayed(this, 1000)
            }
        }
        tickerRunnable = ticker
        tickerHandler?.postDelayed(ticker, 1000)

        // DO NOT INSTALL warning box
        card.addView(TextView(this).apply {
            text = "🛑  DO NOT install this file until ScamShield scan is complete. A full verdict will appear automatically."
            setTextColor(Color.WHITE)
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            setLineSpacing(0f, 1.4f)
            setBackgroundColor(Color.argb(50, 239, 68, 68))
            setPadding(14.dp(), 12.dp(), 14.dp(), 12.dp())
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 8.dp()
            lp.bottomMargin = 20.dp()
            layoutParams = lp
        })

        // Button row
        val btnRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
        }
        btnRow.addView(Button(this).apply {
            text = "OK, I'll Wait"
            setTextColor(orange)
            setBackgroundColor(Color.argb(30, 251, 146, 60))
            textSize = 14f
            setPadding(20.dp(), 10.dp(), 20.dp(), 10.dp())
            setOnClickListener { finish() }
        })
        card.addView(btnRow)
    }

    // ── VERDICT MODE ──────────────────────────────────────────────────────────

    private fun buildVerdictUI(card: LinearLayout, appName: String, packageId: String, dp: Float) {
        fun Int.dp() = (this * dp).toInt()

        val score        = intent.getIntExtra(EXTRA_SCORE, 50)
        val bandName     = intent.getStringExtra(EXTRA_BAND) ?: "CAUTION"
        val verdict      = intent.getStringExtra(EXTRA_VERDICT) ?: "Verify"
        val action       = intent.getStringExtra(EXTRA_ACTION) ?: ""
        val permissions  = intent.getStringArrayListExtra(EXTRA_PERMISSIONS) ?: arrayListOf()
        val isSideloaded = intent.getBooleanExtra(EXTRA_IS_SIDELOADED, false)
        val psStatusName = intent.getStringExtra(EXTRA_PS_STATUS) ?: PlayStoreStatus.UNKNOWN.name
        val psStatus     = runCatching { PlayStoreStatus.valueOf(psStatusName) }.getOrDefault(PlayStoreStatus.UNKNOWN)
        val gate         = intent.getStringExtra(EXTRA_GATE) ?: "na"
        val gateBanner   = intent.getStringExtra(EXTRA_GATE_BANNER) ?: ""
        val gateDetails  = intent.getStringExtra(EXTRA_GATE_DETAILS) ?: ""
        val band = RiskBand.from(bandName.replace("_", "-").lowercase())

        val bgTint      = when (band) { RiskBand.HIGH_RISK -> Color.argb(30, 180, 20, 20); RiskBand.CAUTION -> Color.argb(25, 200, 120, 0); else -> Color.argb(20, 20, 160, 60) }
        val accentColor = when (band) { RiskBand.HIGH_RISK -> Color.rgb(239, 68, 68); RiskBand.CAUTION -> Color.rgb(245, 158, 11); else -> Color.rgb(34, 197, 94) }
        val bandEmoji   = when (band) { RiskBand.HIGH_RISK -> "🚨"; RiskBand.CAUTION -> "⚠️"; else -> "✅" }

        card.setBackgroundColor(bgTint)

        // Band badge
        card.addView(TextView(this).apply {
            text = "$bandEmoji  $verdict"
            setTextColor(accentColor)
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            letterSpacing = 0.08f
            setBackgroundColor(Color.argb(35, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor)))
            setPadding(14.dp(), 6.dp(), 14.dp(), 6.dp())
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 12.dp()
            layoutParams = lp
        })

        // App name
        card.addView(TextView(this).apply {
            text = appName
            setTextColor(Color.WHITE)
            textSize = 22f
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, 0, 0, 2.dp())
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.END
        })

        // Package ID
        if (packageId.isNotEmpty()) {
            card.addView(TextView(this).apply {
                text = packageId
                setTextColor(Color.argb(150, 255, 255, 255))
                textSize = 11f
                typeface = Typeface.MONOSPACE
                setPadding(0, 0, 0, 6.dp())
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.MIDDLE
            })
        }

        // Source + RBI status row
        val sourceRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 6.dp(), 0, 12.dp())
        }
        // Play Store badge
        val (psBadgeText, psBadgeColor) = when (psStatus) {
            PlayStoreStatus.ON_STORE         -> "✅ Google Play Store" to Color.rgb(34, 197, 94)
            PlayStoreStatus.NOT_ON_STORE     -> "⛔ Not on Play Store" to Color.rgb(239, 68, 68)
            PlayStoreStatus.SIDELOADED_CLONE -> "⚠️ On Play Store — downloaded externally" to Color.rgb(245, 158, 11)
            PlayStoreStatus.UNKNOWN          -> if (isSideloaded) "⛔ Not on Play Store" to Color.rgb(239, 68, 68)
                                               else "✅ Google Play Store" to Color.rgb(34, 197, 94)
        }
        sourceRow.addView(TextView(this).apply {
            text = psBadgeText
            setTextColor(psBadgeColor)
            textSize = 10f
            typeface = Typeface.DEFAULT_BOLD
            letterSpacing = 0.04f
            setBackgroundColor(Color.argb(22, Color.red(psBadgeColor), Color.green(psBadgeColor), Color.blue(psBadgeColor)))
            setPadding(10.dp(), 4.dp(), 10.dp(), 4.dp())
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.marginEnd = 8.dp()
            layoutParams = lp
        })
        // RBI gate badge (only if relevant)
        if (gateBanner.isNotEmpty() && gate != "na") {
            val (gColor, gBg) = when (gate) {
                "authorized"   -> Color.rgb(34, 197, 94) to Color.argb(20, 34, 197, 94)
                "unverified",
                "unauthorized" -> Color.rgb(239, 68, 68) to Color.argb(20, 239, 68, 68)
                else           -> Color.argb(160, 255, 255, 255) to Color.TRANSPARENT
            }
            sourceRow.addView(TextView(this).apply {
                text = when (gate) {
                    "authorized"   -> "✅ RBI Registered"
                    "unverified"   -> "⛔ Not RBI Registered"
                    "unauthorized" -> "🚫 RBI Unauthorised"
                    else           -> ""
                }
                setTextColor(gColor)
                textSize = 10f
                typeface = Typeface.DEFAULT_BOLD
                letterSpacing = 0.04f
                setBackgroundColor(gBg)
                setPadding(10.dp(), 4.dp(), 10.dp(), 4.dp())
            })
        }
        card.addView(sourceRow)

        // Gate detail line (only for failed RBI gate)
        if (gateDetails.isNotEmpty() && gate != "na" && gate != "authorized") {
            card.addView(TextView(this).apply {
                text = gateDetails
                setTextColor(Color.argb(160, 255, 255, 255))
                textSize = 11f
                setLineSpacing(0f, 1.3f)
                setPadding(0, 0, 0, 10.dp())
            })
        }

        card.addView(divider(dp))

        // Score row
        val scoreRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 14.dp(), 0, 14.dp())
        }
        val scoreCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        scoreCol.addView(TextView(this).apply {
            text = "RISK SCORE"
            setTextColor(Color.argb(120, 255, 255, 255))
            textSize = 10f
            letterSpacing = 0.1f
        })
        scoreCol.addView(TextView(this).apply {
            text = "$score / 100"
            setTextColor(accentColor)
            textSize = 30f
            typeface = Typeface.DEFAULT_BOLD
        })
        scoreRow.addView(scoreCol)

        // Progress bar
        val barWidth = (resources.displayMetrics.widthPixels * 0.3).toInt()
        val barContainer = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(barWidth, 60.dp())
        }
        barContainer.addView(View(this).apply {
            setBackgroundColor(0x22FFFFFF)
            layoutParams = android.widget.FrameLayout.LayoutParams(barWidth, 10.dp(), Gravity.CENTER_VERTICAL)
        })
        val fillWidth = (barWidth * score / 100).coerceAtLeast(4.dp())
        barContainer.addView(View(this).apply {
            setBackgroundColor(accentColor)
            layoutParams = android.widget.FrameLayout.LayoutParams(fillWidth, 10.dp(), Gravity.CENTER_VERTICAL or Gravity.START)
        })
        scoreRow.addView(barContainer)
        card.addView(scoreRow)

        card.addView(divider(dp))

        // Permissions
        if (permissions.isNotEmpty()) {
            card.addView(TextView(this).apply {
                text = "PERMISSIONS DECLARED"
                setTextColor(Color.argb(120, 255, 255, 255))
                textSize = 10f
                letterSpacing = 0.1f
                setPadding(0, 14.dp(), 0, 10.dp())
            })

            val dangerPerms = setOf(
                "READ_CONTACTS", "READ_SMS", "RECEIVE_SMS", "READ_CALL_LOG", "PROCESS_OUTGOING_CALLS",
                "BIND_ACCESSIBILITY_SERVICE", "BIND_DEVICE_ADMIN", "CAMERA",
                "SYSTEM_ALERT_WINDOW", "READ_EXTERNAL_STORAGE", "READ_MEDIA_IMAGES", "ACCESS_FINE_LOCATION",
                "RECORD_AUDIO", "PACKAGE_USAGE_STATS", "REQUEST_INSTALL_PACKAGES",
            )
            val permDescriptions = mapOf(
                "READ_CONTACTS" to "Reads your full contact list — names, numbers, and email addresses",
                "READ_SMS" to "Reads all SMS messages — including OTPs and bank transaction alerts",
                "RECEIVE_SMS" to "Intercepts incoming SMS in real time — can steal OTPs the moment they arrive",
                "READ_CALL_LOG" to "Reads your full call history — who you called, when, and for how long",
                "PROCESS_OUTGOING_CALLS" to "Can intercept and redirect your outgoing phone calls",
                "BIND_ACCESSIBILITY_SERVICE" to "Full screen control — reads everything you type across all apps, including banking passwords and UPI PINs. Cannot be blocked by other apps.",
                "BIND_DEVICE_ADMIN" to "Can lock your phone remotely and prevent its own uninstallation — traps you",
                "CAMERA" to "Can take photos and record video silently — used for sextortion blackmail",
                "SYSTEM_ALERT_WINDOW" to "Draws fake overlays on top of banking apps — used to steal credentials",
                "READ_EXTERNAL_STORAGE" to "Reads photos, videos, downloaded files, WhatsApp/Telegram media (NOT contacts — contacts need a separate permission)",
                "READ_MEDIA_IMAGES" to "Reads all photos and images stored on your device",
                "ACCESS_FINE_LOCATION" to "Tracks your precise GPS location in real time",
                "RECORD_AUDIO" to "Records audio from your microphone — can listen in on calls and conversations",
                "PACKAGE_USAGE_STATS" to "Sees which apps you open and how long you use them",
                "REQUEST_INSTALL_PACKAGES" to "Installs additional apps silently without your knowledge — primary dropper malware technique",
            )
            permissions.forEach { perm ->
                val short = perm.removePrefix("android.permission.").replace("_", " ")
                val permKey = dangerPerms.firstOrNull { perm.uppercase().contains(it) }
                val isDangerous = permKey != null
                val desc = if (isDangerous) permDescriptions.entries
                    .firstOrNull { perm.uppercase().contains(it.key) }?.value else null

                if (isDangerous) {
                    card.addView(LinearLayout(this).apply {
                        orientation = LinearLayout.VERTICAL
                        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                        lp.topMargin = 6.dp()
                        lp.bottomMargin = 2.dp()
                        layoutParams = lp
                        addView(TextView(this@VerdictOverlayActivity).apply {
                            text = "⚠️  $short"
                            setTextColor(Color.rgb(239, 68, 68))
                            textSize = 12f
                            typeface = Typeface.DEFAULT_BOLD
                        })
                        if (desc != null) {
                            addView(TextView(this@VerdictOverlayActivity).apply {
                                text = desc
                                setTextColor(Color.argb(160, 255, 200, 200))
                                textSize = 11f
                                setLineSpacing(0f, 1.25f)
                                setPadding(22.dp(), 2.dp(), 0, 0)
                            })
                        }
                    })
                } else {
                    card.addView(TextView(this).apply {
                        text = "•  $short"
                        setTextColor(Color.argb(160, 255, 255, 255))
                        textSize = 12f
                        setPadding(0, 3.dp(), 0, 3.dp())
                    })
                }
            }
        }

        card.addView(divider(dp).apply {
            val lp = layoutParams as LinearLayout.LayoutParams
            lp.topMargin = 14.dp()
            layoutParams = lp
        })

        // Recommended action
        card.addView(TextView(this).apply {
            text = action
            setTextColor(Color.argb(210, 255, 255, 255))
            textSize = 13f
            setLineSpacing(0f, 1.35f)
            setPadding(0, 14.dp(), 0, 20.dp())
        })

        // Button row
        val btnRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
        }

        if (band == RiskBand.HIGH_RISK && packageId.isNotEmpty()) {
            btnRow.addView(Button(this).apply {
                text = "Uninstall"
                setTextColor(Color.rgb(239, 68, 68))
                setBackgroundColor(Color.argb(35, 239, 68, 68))
                textSize = 13f
                setPadding(16.dp(), 8.dp(), 16.dp(), 8.dp())
                setOnClickListener {
                    startActivity(Intent(Intent.ACTION_DELETE, Uri.parse("package:$packageId")).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    })
                    finish()
                }
            })
        }

        if (band == RiskBand.HIGH_RISK) {
            btnRow.addView(Button(this).apply {
                text = "Call 1930"
                setTextColor(Color.WHITE)
                setBackgroundColor(Color.rgb(239, 68, 68))
                textSize = 13f
                setPadding(16.dp(), 8.dp(), 16.dp(), 8.dp())
                setOnClickListener {
                    startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:1930")).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    })
                    finish()
                }
            })
        }

        btnRow.addView(Button(this).apply {
            text = "Dismiss"
            setTextColor(Color.argb(200, 255, 255, 255))
            setBackgroundColor(Color.TRANSPARENT)
            textSize = 13f
            setPadding(16.dp(), 8.dp(), 16.dp(), 8.dp())
            setOnClickListener { finish() }
        })

        card.addView(btnRow)
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private fun divider(dp: Float): View = View(this).apply {
        setBackgroundColor(0x22FFFFFF)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1)
    }
}
