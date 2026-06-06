package ai.scamshield.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class PlayStoreAccessibilityService : AccessibilityService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // LRU: insertion-ordered, evicts oldest entry beyond capacity
    private val seenApps = LinkedHashSet<String>()

    companion object {
        private val INSTALL_LABELS = setOf("Install", "Download", "इंस्टॉल करें", "डाउनलोड करें")
        private val UI_NOISE = listOf("Install", "Download", "Update", "Open", "Rating", "review", "Free", "$")
    }

    override fun onServiceConnected() {
        serviceInfo = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                    AccessibilityEvent.TYPE_VIEW_CLICKED
            packageNames = arrayOf("com.android.vending", "com.google.android.finsky")
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            notificationTimeout = 200
        }
        Log.d(LOG_TAG, "Accessibility service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        try {
            handleEvent(event)
        } catch (e: Exception) {
            // An uncaught exception here causes the system to disable the service permanently
            Log.w(LOG_TAG, "Accessibility event error", e)
        }
    }

    private fun handleEvent(event: AccessibilityEvent) {
        val root = rootInActiveWindow ?: return
        val (appName, hasButton) = analyzePage(root)
        root.recycle()

        if (appName == null || !hasButton) return

        val isClick = event.eventType == AccessibilityEvent.TYPE_VIEW_CLICKED
        val key = "$appName:${event.packageName}"
        if (!shouldScan(key, forceOnClick = isClick)) return

        Log.d(LOG_TAG, "Play Store: detected '$appName' with install button")
        ScamNotificationManager.showPreInstallCheck(applicationContext, appName)

        serviceScope.launch {
            try {
                val fakePackage = appName.toFakePackageId("playstore")
                val result = ScamApiClient.verify(
                    AppSignals.minimal(fakePackage, appName, "com.android.vending")
                )
                ScamNotificationManager.showVerdict(applicationContext, appName, fakePackage, result)
            } catch (e: Exception) {
                Log.e(LOG_TAG, "Pre-install scan failed for $appName", e)
            }
        }
    }

    private data class PageAnalysis(val appName: String?, val hasInstallButton: Boolean)

    private fun analyzePage(root: AccessibilityNodeInfo): PageAnalysis {
        var foundName: String? = null
        var foundButton = false
        walkTree(root, depth = 8) { node ->
            val text = node.text?.toString()?.takeIf { it.isNotBlank() } ?: return@walkTree
            when {
                text in INSTALL_LABELS -> foundButton = true
                foundName == null && text.length in 3..50 && UI_NOISE.none { text.contains(it) } -> {
                    val id = node.viewIdResourceName ?: ""
                    if (id.contains("title") || id.contains("name")) foundName = text
                }
            }
        }
        return PageAnalysis(foundName, foundButton)
    }

    /** Walks the tree once, recycling each child after visiting. Root is NOT recycled here. */
    private fun walkTree(node: AccessibilityNodeInfo, depth: Int, visitor: (AccessibilityNodeInfo) -> Unit) {
        if (depth <= 0) return
        visitor(node)
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            walkTree(child, depth - 1, visitor)
            child.recycle()
        }
    }

    private fun shouldScan(key: String, forceOnClick: Boolean): Boolean {
        if (key in seenApps && !forceOnClick) return false
        if (seenApps.size >= 50) seenApps.remove(seenApps.first())
        seenApps.add(key)
        return true
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }
}
