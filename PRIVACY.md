# ScamShield Privacy Policy

**Effective date: January 2026**

This policy explains what data ScamShield collects, how it is used, and your rights over it. It is written in plain English — no legalese that buries the meaning.

---

## 1. What we collect

### App verifications

When you use ScamShield to verify an app, we receive:
- The name of the app you searched for
- The package ID (e.g., `com.example.loanapp`), if you submitted it
- The timestamp of the verification
- The verdict we returned

We do not link this to your identity. There are no user accounts. Verification requests are processed server-side and stored in aggregate for model improvement (see Section 3).

### Community reports

If you voluntarily submit a scam report about an app, we collect:
- The app name and package ID
- The category of scam you reported (e.g., "contacted my family", "demanded upfront fees")
- The timestamp of the report
- A pseudonymous device identifier (a random UUID generated on your device) to prevent duplicate reports from the same device

We do not collect your name, phone number, or any other identifying information when you submit a report.

---

## 2. What we do NOT collect

ScamShield does not access, read, transmit, or store any of the following:

- Your contacts or address book
- Your SMS messages, call logs, or phone history
- Your photos, camera feed, or microphone
- Your location (GPS or network-based)
- Your device hardware identifiers (IMEI, IMSI, MAC address, advertising ID)
- Your financial data or bank account information
- The list of apps installed on your device (on iOS; on Android, the install-watcher feature reads newly installed package names — see Section 2a)

### 2a. Android install-watcher (optional feature)

If you enable the install-watcher feature on Android, the app monitors for newly installed packages using the `ACTION_PACKAGE_ADDED` broadcast. When a new app is installed:

- ScamShield reads the package name and app label of the newly installed app
- It shows you a notification prompting you to verify the app
- The package name may be sent to the ScamShield backend to retrieve a verdict

The install-watcher does not scan your pre-existing installed apps. It only processes apps installed after you enable the feature. You can disable it at any time in ScamShield's settings.

---

## 3. How we use data

**Improve scam detection**: Aggregated verification queries and community reports help us identify patterns in scam app naming, permission abuse, and infrastructure. We use this to tune scoring weights and add new detection signals. No individual query is used to build a profile of you.

**Aggregate statistics**: We may publish summary statistics (e.g., "ScamShield processed 50,000 verifications this month, with 12% returning a High Risk verdict"). These are never broken down in a way that could identify individuals.

**We do not use your data for advertising.** We do not build behavioural profiles. We do not share data with data brokers or marketing platforms.

---

## 4. Data retention

| Data type | Retention period |
|---|---|
| Community reports | 2 years from submission date |
| Verification logs (aggregated, non-identifying) | 12 months |
| Verification history on your device | Stored locally only; never uploaded |
| Your pseudonymous device UUID | Stored locally on your device |

After the retention period, data is permanently deleted from our servers. Verification history stored on your device is controlled entirely by you — uninstalling ScamShield removes it.

---

## 5. Third parties

ScamShield does not integrate any third-party analytics SDKs (no Firebase Analytics, no Mixpanel, no Amplitude), advertising networks, or data-sharing partners.

The only external data source the app communicates with is the ScamShield backend API (hosted by us). In the future, if we integrate any third-party service, this policy will be updated and you will be notified in the app before the change takes effect.

**RBI dataset**: ScamShield fetches the RBI's Digital Lending App directory to power its verification engine. This is a public government dataset. Your query is not sent to the RBI.

---

## 6. Your rights

You have the right to:

- **Delete your reports**: If you submitted a community report and want it removed, contact us at privacy@scamshield.ai with the app name and approximate submission date. We will locate and delete the record within 7 business days.
- **Know what we hold**: You can request a summary of any data associated with your pseudonymous device UUID. Email us at privacy@scamshield.ai.
- **Opt out of model improvement**: If you do not want your verification queries used in aggregate model training, email us and we will flag your device UUID as opted out.

Because we do not collect names, emails, or account credentials, we verify deletion and access requests by asking you to confirm the pseudonymous UUID visible in ScamShield's Settings screen.

---

## 7. Security

Verification queries are transmitted over HTTPS. Community reports are stored in a database accessible only to ScamShield's backend infrastructure. We do not store sensitive personal data, which limits the damage from any potential breach. If a breach occurs that affects user data, we will notify affected users within 72 hours and publish a public post-mortem.

---

## 8. Children

ScamShield is not directed at children under 13. We do not knowingly collect data from children under 13. If you believe a child has submitted data through the app, contact privacy@scamshield.ai and we will delete it promptly.

---

## 9. Changes to this policy

If we make material changes (new data collected, new sharing partners), we will show an in-app notice before the changes take effect and update the effective date at the top of this document. Minor clarifications may be made without notice.

---

## 10. Contact

For privacy questions, data deletion requests, or concerns:

**Email**: privacy@scamshield.ai

We aim to respond within 5 business days.
