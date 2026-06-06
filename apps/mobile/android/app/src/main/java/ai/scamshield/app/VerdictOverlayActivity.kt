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

/**
 * Full-screen overlay that fires over the current app when a verdict is ready.
 * Shows risk band, score, key permissions, and action buttons.
 * No SYSTEM_ALERT_WINDOW needed — uses Activity window flags instead.
 */
class VerdictOverlayActivity : Activity() {

    companion object {
        private const val EXTRA_APP_NAME    = "app_name"
        private const val EXTRA_PKG_ID      = "pkg_id"
        private const val EXTRA_SCORE       = "score"
        private const val EXTRA_BAND        = "band"
        private const val EXTRA_VERDICT     = "verdict"
        private const val EXTRA_ACTION      = "action"
        private const val EXTRA_PERMISSIONS = "permissions"

        fun launch(
            context: Context,
            appName: String,
            packageId: String,
            result: ScanResult,
            permissions: List<String> = emptyList(),
        ) {
            context.startActivity(
                Intent(context, VerdictOverlayActivity::class.java).apply {
                    putExtra(EXTRA_APP_NAME, appName)
                    putExtra(EXTRA_PKG_ID, packageId)
                    putExtra(EXTRA_SCORE, result.score)
                    putExtra(EXTRA_BAND, result.band.name)
                    putExtra(EXTRA_VERDICT, result.verdictLabel)
                    putExtra(EXTRA_ACTION, result.recommendedAction)
                    putStringArrayListExtra(EXTRA_PERMISSIONS, ArrayList(permissions.take(8)))
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_NO_HISTORY or
                        Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
                    )
                }
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Show over lock screen and wake up the display
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
        val score      = intent.getIntExtra(EXTRA_SCORE, 50)
        val bandName   = intent.getStringExtra(EXTRA_BAND) ?: "CAUTION"
        val verdict    = intent.getStringExtra(EXTRA_VERDICT) ?: "Verify"
        val action     = intent.getStringExtra(EXTRA_ACTION) ?: ""
        val permissions = intent.getStringArrayListExtra(EXTRA_PERMISSIONS) ?: arrayListOf()
        val band = RiskBand.from(bandName.replace("_", "-").lowercase())

        val bgColor     = when (band) { RiskBand.HIGH_RISK -> 0xFF1A0505.toInt(); RiskBand.CAUTION -> 0xFF1A1005.toInt(); else -> 0xFF051A0A.toInt() }
        val accentColor = when (band) { RiskBand.HIGH_RISK -> Color.rgb(239, 68, 68); RiskBand.CAUTION -> Color.rgb(245, 158, 11); else -> Color.rgb(34, 197, 94) }
        val bandEmoji   = when (band) { RiskBand.HIGH_RISK -> "🚨"; RiskBand.CAUTION -> "⚠️"; else -> "✅" }

        val dp = resources.displayMetrics.density
        fun Int.dp() = (this * dp).toInt()

        // Root — full screen, dark scrim
        val root = FrameLayout(this).apply {
            setBackgroundColor(0xCC000000.toInt())
        }

        // Card
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(bgColor)
            elevation = 24 * dp
            setPadding(24.dp(), 24.dp(), 24.dp(), 24.dp())
        }

        // Band badge row
        val badgeRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val badgeView = TextView(this).apply {
            text = "$bandEmoji  $verdict"
            setTextColor(accentColor)
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            setBackgroundColor(Color.argb(30, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor)))
            setPadding(14.dp(), 6.dp(), 14.dp(), 6.dp())
            letterSpacing = 0.08f
        }
        badgeRow.addView(badgeView)
        card.addView(badgeRow)

        // App name
        card.addView(TextView(this).apply {
            text = appName
            setTextColor(Color.WHITE)
            textSize = 22f
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, 12.dp(), 0, 2.dp())
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
                setPadding(0, 0, 0, 14.dp())
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.MIDDLE
            })
        }

        // Divider
        card.addView(View(this).apply { setBackgroundColor(0x22FFFFFF); layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1) })

        // Score row
        val scoreRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 14.dp(), 0, 14.dp())
        }
        scoreRow.addView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            (layoutParams as? LinearLayout.LayoutParams)?.weight = 1f
            addView(TextView(this@VerdictOverlayActivity).apply {
                text = "RISK SCORE"
                setTextColor(Color.argb(120, 255, 255, 255))
                textSize = 10f
                letterSpacing = 0.1f
            })
            addView(TextView(this@VerdictOverlayActivity).apply {
                text = "$score / 100"
                setTextColor(accentColor)
                textSize = 28f
                typeface = Typeface.DEFAULT_BOLD
            })
        })
        // Score bar
        val barContainer = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(100.dp(), 100.dp())
        }
        val barBg = View(this).apply {
            setBackgroundColor(0x22FFFFFF)
            layoutParams = FrameLayout.LayoutParams(100.dp(), 8.dp(), Gravity.CENTER_VERTICAL)
        }
        val barFill = View(this).apply {
            setBackgroundColor(accentColor)
            layoutParams = FrameLayout.LayoutParams((score.dp()), 8.dp(), Gravity.CENTER_VERTICAL)
        }
        barContainer.addView(barBg)
        barContainer.addView(barFill)
        scoreRow.addView(barContainer)
        card.addView(scoreRow)

        // Divider
        card.addView(View(this).apply { setBackgroundColor(0x22FFFFFF); layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1) })

        // Permissions section
        if (permissions.isNotEmpty()) {
            card.addView(TextView(this).apply {
                text = "PERMISSIONS REQUESTED"
                setTextColor(Color.argb(120, 255, 255, 255))
                textSize = 10f
                letterSpacing = 0.1f
                setPadding(0, 14.dp(), 0, 8.dp())
            })

            val dangerPerms = setOf(
                "READ_CONTACTS", "READ_SMS", "RECEIVE_SMS", "READ_CALL_LOG",
                "BIND_ACCESSIBILITY_SERVICE", "BIND_DEVICE_ADMIN", "CAMERA",
                "SYSTEM_ALERT_WINDOW", "READ_EXTERNAL_STORAGE", "ACCESS_FINE_LOCATION"
            )

            permissions.forEach { perm ->
                val short = perm.removePrefix("android.permission.").replace("_", " ")
                val isDangerous = dangerPerms.any { perm.contains(it) }
                val permColor = if (isDangerous) Color.rgb(239, 68, 68) else Color.argb(180, 255, 255, 255)
                val icon = if (isDangerous) "⚠️ " else "• "
                card.addView(TextView(this).apply {
                    text = "$icon$short"
                    setTextColor(permColor)
                    textSize = 12f
                    setPadding(0, 3.dp(), 0, 3.dp())
                })
            }
        }

        // Divider
        card.addView(View(this).apply {
            setBackgroundColor(0x22FFFFFF)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1).apply { topMargin = 14.dp() }
        })

        // Recommended action
        card.addView(TextView(this).apply {
            text = action
            setTextColor(Color.argb(200, 255, 255, 255))
            textSize = 13f
            lineSpacingMultiplier = 1.3f
            setPadding(0, 14.dp(), 0, 20.dp())
        })

        // Buttons
        val btnRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
        }

        if (band == RiskBand.HIGH_RISK && packageId.isNotEmpty()) {
            btnRow.addView(Button(this).apply {
                text = "Uninstall"
                setTextColor(Color.rgb(239, 68, 68))
                setBackgroundColor(Color.argb(30, 239, 68, 68))
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

        // Layout card in root (centered, max-width)
        val cardParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        ).apply { setMargins(24.dp(), 0, 24.dp(), 0) }
        root.addView(card, cardParams)

        // Tap outside to dismiss
        root.setOnClickListener { finish() }

        setContentView(root)
    }
}
