import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
    GoogleAuthProvider,
    OAuthProvider,
    deleteUser,
    getAdditionalUserInfo,
    getAuth,
    getIdToken,
    inMemoryPersistence,
    revokeAccessToken,
    setPersistence,
    signInWithPopup,
    signOut,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
    DeletionWorkflowError,
    createDeletionWorkflow,
    deletionEndpointFor,
} from "./account-deletion-controller.mjs";

const firebaseConfig = {
    // Firebase Web API keys identify a project; they are not server credentials.
    // Keep this key restricted to the Firebase APIs and deployed hosts documented
    // in account-deletion-runbook.md. measurementId is deliberately omitted: this
    // page never loads Analytics.
    apiKey: "AIzaSyD4THOW_CMEpEK2qKZXaWMTFXdYiv_cZ-g",
    authDomain: "mahjongleh-433ce.firebaseapp.com",
    projectId: "mahjongleh-433ce",
    appId: "1:822092511461:web:809906a12d0877cceabc0c",
};
const deletionEndpoint = deletionEndpointFor(window.location);
const firebaseWebAppConfigured = !firebaseConfig.apiKey.startsWith("REPLACE_");

const elements = {
    status: document.querySelector("#status"),
    signInPanel: document.querySelector("#sign-in-panel"),
    confirmationPanel: document.querySelector("#confirmation-panel"),
    completionPanel: document.querySelector("#completion-panel"),
    googleSignIn: document.querySelector("#google-sign-in"),
    appleSignIn: document.querySelector("#apple-sign-in"),
    verifiedProvider: document.querySelector("#verified-provider"),
    acknowledge: document.querySelector("#acknowledge-consequences"),
    deletePhrase: document.querySelector("#delete-phrase"),
    deleteAccount: document.querySelector("#delete-account"),
    useDifferentAccount: document.querySelector("#use-different-account"),
    appleFollowUp: document.querySelector("#apple-follow-up"),
};

const embedded = window.self !== window.top;
let auth = null;
let googleProvider = null;
let appleProvider = null;
let authReady = false;

if (embedded) {
    disableInteractiveControls();
    showStatus(
        "For your protection, account deletion cannot run inside another site. "
        + "Open playleh.com/account-deletion.html directly.",
        "error",
    );
} else if (deletionEndpoint == null) {
    disableInteractiveControls();
    showStatus(
        "Account deletion is not available from this website address. "
        + "Open https://playleh.com/account-deletion.html directly.",
        "error",
    );
} else if (!firebaseWebAppConfigured) {
    disableInteractiveControls();
    showStatus(
        "Web account recovery is not configured yet. Nothing was deleted; "
        + "contact PlayLeh support.",
        "error",
    );
} else {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        await setPersistence(auth, inMemoryPersistence);
        await safeSignOut();
        googleProvider = new GoogleAuthProvider();
        googleProvider.setCustomParameters({ prompt: "select_account" });
        appleProvider = new OAuthProvider("apple.com");
        appleProvider.addScope("email");
        appleProvider.addScope("name");
        authReady = true;
    } catch {
        disableInteractiveControls();
        showStatus(
            "Secure sign-in could not be initialized. Nothing was deleted; "
            + "retry later or contact PlayLeh support.",
            "error",
        );
    }
}

const workflow = createDeletionWorkflow({
    async signIn(provider) {
        const firebaseProvider = provider === "google" ? googleProvider : appleProvider;
        const result = await signInWithPopup(auth, firebaseProvider);
        const additionalInfo = getAdditionalUserInfo(result);
        const appleCredential = provider === "apple"
            ? OAuthProvider.credentialFromResult(result)
            : null;
        return {
            user: result.user,
            accountStatus: additionalInfo == null
                ? "unknown"
                : additionalInfo.isNewUser ? "new" : "existing",
            appleAccessToken: appleCredential?.accessToken ?? null,
        };
    },

    async discardNewAccount(candidate) {
        let appleRevocationPending = false;
        if (candidate.appleAccessToken != null) {
            try {
                await revokeAccessToken(auth, candidate.appleAccessToken);
            } catch {
                appleRevocationPending = true;
            }
        }
        try {
            await deleteUser(candidate.user);
        } catch {
            throw new DeletionWorkflowError("new-account-cleanup-failed", {
                appleRevocationPending,
            });
        } finally {
            await safeSignOut();
        }
        return { appleRevocationPending };
    },

    async getFreshIDToken(session) {
        if (auth.currentUser !== session.user) {
            throw new DeletionWorkflowError("session-changed");
        }
        return getIdToken(session.user, true);
    },

    async prepareDeletion(idToken) {
        return fetch(deletionEndpoint, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${idToken}` },
            body: null,
            credentials: "omit",
            cache: "no-store",
            redirect: "error",
            referrerPolicy: "no-referrer",
            signal: AbortSignal.timeout(30_000),
        });
    },

    async revokeAppleAccessToken(token) {
        await revokeAccessToken(auth, token);
    },

    async deleteFirebaseUser(user) {
        if (auth.currentUser !== user) {
            throw new DeletionWorkflowError("session-changed");
        }
        await deleteUser(user);
    },

    signOut: safeSignOut,
});

if (authReady) {
    elements.googleSignIn.disabled = false;
    elements.appleSignIn.disabled = false;
    elements.googleSignIn.addEventListener("click", () => beginSignIn("google"));
    elements.appleSignIn.addEventListener("click", () => beginSignIn("apple"));
    elements.acknowledge.addEventListener("change", updateDeleteAvailability);
    elements.deletePhrase.addEventListener("input", updateDeleteAvailability);
    elements.deleteAccount.addEventListener("click", completeDeletion);
    elements.useDifferentAccount.addEventListener("click", resetFlow);
}

async function beginSignIn(provider) {
    setBusy(true);
    showStatus("Opening secure sign-in…");
    try {
        const result = await workflow.signIn(provider);
        if (result.kind === "account-not-found") {
            showStatus(
                "No existing MahjongLeh account was linked to that provider account. "
                + "The new empty sign-in account was removed. Try the provider and account used in MahjongLeh."
                + (result.appleRevocationPending
                    ? " Apple authorization may still need to be removed from your Apple Account settings."
                    : ""),
                "error",
            );
            return;
        }
        elements.verifiedProvider.textContent = provider === "apple"
            ? "Verified with Apple. No account identifier is shown on this page."
            : "Verified with Google. No account identifier is shown on this page.";
        elements.signInPanel.hidden = true;
        elements.confirmationPanel.hidden = false;
        elements.deletePhrase.value = "";
        elements.acknowledge.checked = false;
        updateDeleteAvailability();
        showStatus("Account ownership verified. Review the deletion consequences before continuing.", "success");
        document.querySelector("#confirmation-title")?.focus();
    } catch (error) {
        logLoopbackDiagnostic(error);
        showStatus(messageForError(error), "error");
    } finally {
        setBusy(false);
    }
}

async function completeDeletion() {
    if (!elements.acknowledge.checked || elements.deletePhrase.value.trim() !== "DELETE") {
        return;
    }
    setBusy(true);
    showStatus("Submitting the deletion request. Do not close this page…");
    try {
        const result = await workflow.deleteAccount();
        elements.confirmationPanel.hidden = true;
        elements.signInPanel.hidden = true;
        elements.completionPanel.hidden = false;
        elements.appleFollowUp.hidden = !result.appleRevocationPending;
        showStatus("Account deletion completed.", "success");
    } catch (error) {
        if (error instanceof DeletionWorkflowError && error.code === "firebase-delete-failed") {
            elements.confirmationPanel.hidden = true;
            elements.signInPanel.hidden = false;
            showStatus(
                "The backend recorded the request, but Firebase account deletion did not finish. "
                + "Your account may still be active. Sign in again and retry; the request is safe to repeat.",
                "error",
            );
        } else {
            showStatus(messageForError(error), "error");
            if (error instanceof DeletionWorkflowError && error.status === 401) {
                await resetToSignIn();
            }
        }
    } finally {
        setBusy(false);
    }
}

async function resetFlow() {
    setBusy(true);
    try {
        await resetToSignIn();
        showStatus("The previous in-memory sign-in was cleared.");
    } finally {
        setBusy(false);
    }
}

async function resetToSignIn() {
    await workflow.reset();
    elements.confirmationPanel.hidden = true;
    elements.completionPanel.hidden = true;
    elements.signInPanel.hidden = false;
    elements.deletePhrase.value = "";
    elements.acknowledge.checked = false;
    updateDeleteAvailability();
}

function updateDeleteAvailability() {
    elements.deleteAccount.disabled = !workflow.hasVerifiedSession
        || !elements.acknowledge.checked
        || elements.deletePhrase.value.trim() !== "DELETE";
}

function setBusy(busy) {
    elements.googleSignIn.disabled = busy;
    elements.appleSignIn.disabled = busy;
    elements.useDifferentAccount.disabled = busy;
    if (busy) {
        elements.deleteAccount.disabled = true;
    } else {
        updateDeleteAvailability();
    }
}

function disableInteractiveControls() {
    elements.googleSignIn.disabled = true;
    elements.appleSignIn.disabled = true;
    elements.acknowledge.disabled = true;
    elements.deletePhrase.disabled = true;
    elements.deleteAccount.disabled = true;
    elements.useDifferentAccount.disabled = true;
}

function showStatus(message, kind = "info") {
    elements.status.textContent = message;
    elements.status.className = kind === "error"
        ? "status status-error"
        : kind === "success" ? "status status-success" : "status";
    // Errors in a destructive flow should be announced assertively.
    elements.status.setAttribute("role", kind === "error" ? "alert" : "status");
    elements.status.hidden = false;
}

function messageForError(error) {
    if (error instanceof DeletionWorkflowError) {
        if (error.code === "operation-in-progress") {
            return "Another account operation is already in progress.";
        }
        if (error.code === "account-status-unknown") {
            return "We could not safely determine whether this sign-in belongs to an existing MahjongLeh account.";
        }
        if (error.code === "new-account-cleanup-failed") {
            return "This provider was not linked to an existing MahjongLeh account, and the new empty sign-in account could not be cleaned up automatically. Contact PlayLeh support before retrying."
                + (error.appleRevocationPending
                    ? " Apple authorization may also need to be removed from your Apple Account settings."
                    : "");
        }
        if (error.code === "session-changed" || error.code === "sign-in-required") {
            return "The in-memory sign-in changed. Sign in again before retrying.";
        }
        if (error.code === "backend-rejected") {
            if (error.status === 401) {
                return "The backend could not verify this fresh sign-in. Sign in again before retrying.";
            }
            if (error.status === 403) {
                return "This identity is not eligible for self-service deletion. Contact PlayLeh support.";
            }
            if (error.status === 503) {
                return "Account deletion is temporarily unavailable. Nothing was deleted; please retry later.";
            }
            return "The deletion request was not accepted. Nothing was deleted; please retry later.";
        }
    }
    if (error?.name === "TimeoutError") {
        return "The deletion service did not respond in time. Your account was not deleted; "
            + "it is safe to retry later.";
    }
    const code = typeof error?.code === "string" ? error.code : "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request"
        || code === "auth/user-cancelled") {
        return "Sign-in was canceled. Nothing was deleted.";
    }
    if (code === "auth/popup-blocked") {
        return "The browser blocked the sign-in window. Allow pop-ups for playleh.com and retry.";
    }
    if (code === "auth/account-exists-with-different-credential") {
        return "That account is linked through a different provider. Try the Apple or Google method originally used in MahjongLeh.";
    }
    if (code === "auth/network-request-failed") {
        return "The sign-in service is temporarily unreachable. Nothing was deleted; check your connection and retry.";
    }
    if (code === "auth/web-storage-unsupported"
        || code === "auth/operation-not-supported-in-this-environment") {
        return "This browser blocks the storage that secure sign-in requires. Nothing was deleted; open this page in a standard browser such as Chrome, Safari, or Firefox.";
    }
    if (code === "auth/unauthorized-domain") {
        return "This website address is not authorized for MahjongLeh sign-in. Nothing was deleted; open https://playleh.com/account-deletion.html directly.";
    }
    if (code === "auth/operation-not-allowed") {
        return "This sign-in provider is not configured for web account recovery yet. Nothing was deleted; contact PlayLeh support.";
    }
    return "The account operation could not be completed. Nothing was reported as deleted; please retry or contact support.";
}

function logLoopbackDiagnostic(error) {
    // Local-debug aid only: never active on the canonical origin, and prints
    // only the error code/message, never tokens, UIDs, or credentials.
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]" && host !== "::1") {
        return;
    }
    console.error(
        "local-debug failure:",
        error?.code ?? error?.name ?? "unknown",
        "-", error?.message ?? "",
        "-", error?.customData?.message ?? "",
    );
}

async function safeSignOut() {
    if (auth == null) {
        return;
    }
    try {
        await signOut(auth);
    } catch {
        // Persistence is in-memory and the workflow also discards its session.
    }
}
