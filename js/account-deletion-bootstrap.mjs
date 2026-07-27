// No top-level await: this file must parse on every browser that understands modules at all,
// otherwise a parse error here would silence the very failure message it exists to show. The
// deletion module itself uses top-level await, so older engines reject it at parse time and the
// dynamic import rejects — which is exactly what this handler reports.
function reportLoadFailure() {
    const status = document.querySelector("#status");
    if (status != null) {
        status.textContent = "Secure sign-in could not be loaded. Nothing was deleted; "
            + "retry later or contact PlayLeh support.";
        status.className = "status status-error";
        status.hidden = false;
    }
}

try {
    import("./account-deletion.mjs").catch(reportLoadFailure);
} catch {
    reportLoadFailure();
}
