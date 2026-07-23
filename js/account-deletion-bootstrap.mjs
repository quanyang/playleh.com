try {
    await import("./account-deletion.mjs");
} catch {
    const status = document.querySelector("#status");
    if (status != null) {
        status.textContent = "Secure sign-in could not be loaded. Nothing was deleted; "
            + "retry later or contact PlayLeh support.";
        status.className = "status status-error";
        status.hidden = false;
    }
}
