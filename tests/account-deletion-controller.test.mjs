import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    DeletionWorkflowError,
    createDeletionWorkflow,
    deletionEndpointFor,
    diagnosticCodeFor,
    fetchWithTimeout,
} from "../js/account-deletion-controller.mjs";

function fixture(overrides = {}) {
    const calls = [];
    const user = { id: "opaque-test-user" };
    const dependencies = {
        async signIn(provider) {
            calls.push(`sign-in:${provider}`);
            return { accountStatus: "existing", user, appleAccessToken: "apple-token" };
        },
        async discardNewAccount() {
            calls.push("discard-new");
            return { appleRevocationPending: false };
        },
        async getFreshIDToken() {
            calls.push("fresh-token");
            return "firebase-token";
        },
        async prepareDeletion(token) {
            assert.equal(token, "firebase-token");
            calls.push("prepare");
            return { status: 204 };
        },
        async revokeAppleAccessToken() {
            calls.push("revoke-apple");
        },
        async deleteFirebaseUser(receivedUser) {
            assert.equal(receivedUser, user);
            calls.push("delete-firebase");
        },
        async signOut() {
            calls.push("sign-out");
        },
        ...overrides,
    };
    return { calls, user, workflow: createDeletionWorkflow(dependencies) };
}

test("endpoint selection permits only canonical production and loopback origins", () => {
    assert.equal(
        deletionEndpointFor(new URL("https://playleh.com/account-deletion.html")),
        "https://mahjong-go.playleh.com/v1/account",
    );
    assert.equal(
        deletionEndpointFor(new URL("http://127.0.0.1:8081/account-deletion.html")),
        "http://127.0.0.1:8080/v1/account",
    );
    assert.equal(
        deletionEndpointFor(new URL("http://localhost:8081/account-deletion.html")),
        "http://localhost:8080/v1/account",
    );
    assert.equal(deletionEndpointFor(new URL("http://[::1]:8081/account-deletion.html")), null);
    assert.equal(deletionEndpointFor(new URL("https://preview.playleh.com")), null);
    assert.equal(deletionEndpointFor(new URL("https://playleh.com.evil.example")), null);
    assert.equal(deletionEndpointFor(new URL("http://playleh.com")), null);
});

test("static CSP permits every selected loopback backend and no refused IPv6 backend", () => {
    const page = readFileSync(new URL("../account-deletion.html", import.meta.url), "utf8");
    assert.match(page, /connect-src[^"]*http:\/\/127\.0\.0\.1:8080/);
    assert.match(page, /connect-src[^"]*http:\/\/localhost:8080/);
    assert.doesNotMatch(page, /\[::1\]/);
});

test("portable request timeout aborts fetch and returns a stable workflow error", async () => {
    let abortCalled = false;
    let scheduledDelay = null;
    let clearTimerArgument = null;
    let rejectFetch;
    const fakeSignal = { aborted: false };
    class FakeAbortController {
        signal = fakeSignal;

        abort() {
            abortCalled = true;
            fakeSignal.aborted = true;
            rejectFetch(new Error("browser-specific abort text with user@example.com"));
        }
    }
    const fetchPromise = fetchWithTimeout(
        (_input, init) => {
            assert.equal(init.signal, fakeSignal);
            return new Promise((_resolve, reject) => {
                rejectFetch = reject;
            });
        },
        "http://127.0.0.1:8080/v1/account",
        { method: "DELETE" },
        30_000,
        {
            AbortController: FakeAbortController,
            setTimeout(callback, delay) {
                scheduledDelay = delay;
                queueMicrotask(callback);
                return 42;
            },
            clearTimeout(timerID) {
                clearTimerArgument = timerID;
            },
        },
    );

    await assert.rejects(
        fetchPromise,
        (error) => error instanceof DeletionWorkflowError
            && error.code === "request-timeout"
            && !error.message.includes("user@example.com"),
    );
    assert.equal(scheduledDelay, 30_000);
    assert.equal(abortCalled, true);
    assert.equal(clearTimerArgument, 42);
});

test("portable request timeout clears its timer after a successful response", async () => {
    let passedSignal = null;
    let clearedTimerID = null;
    const response = { status: 204 };

    const actual = await fetchWithTimeout(
        async (_input, init) => {
            passedSignal = init.signal;
            return response;
        },
        "https://mahjong-go.playleh.com/v1/account",
        { method: "DELETE" },
        123,
        {
            AbortController,
            setTimeout() {
                return 7;
            },
            clearTimeout(timerID) {
                clearedTimerID = timerID;
            },
        },
    );

    assert.equal(actual, response);
    assert.ok(passedSignal);
    assert.equal(clearedTimerID, 7);
});

test("diagnostics expose only stable codes and never provider messages or identifiers", () => {
    assert.equal(diagnosticCodeFor({
        code: "auth/network-request-failed",
        message: "UID abc123 belongs to user@example.com",
        customData: { message: "token secret-token" },
    }), "auth/network-request-failed");
    assert.equal(diagnosticCodeFor(new DeletionWorkflowError("backend-rejected")), "workflow/backend-rejected");
    assert.equal(diagnosticCodeFor({
        code: "auth/user@example.com",
        name: "FirebaseError",
        message: "secret-token",
    }), "FirebaseError");
    assert.equal(diagnosticCodeFor({
        code: "user@example.com",
        name: "not safe either",
        message: "secret-token",
    }), "unknown");
});

test("Google deletion verifies backend before deleting Firebase", async () => {
    const subject = fixture();
    assert.deepEqual(await subject.workflow.signIn("google"), { kind: "ready", provider: "google" });
    assert.equal(subject.workflow.hasVerifiedSession, true);
    assert.deepEqual(await subject.workflow.deleteAccount(), {
        kind: "deleted",
        appleRevocationPending: false,
    });
    assert.deepEqual(subject.calls, [
        "sign-in:google",
        "fresh-token",
        "prepare",
        "delete-firebase",
        "sign-out",
    ]);
    assert.equal(subject.workflow.hasVerifiedSession, false);
});

test("Apple revocation happens after backend preparation and before Firebase deletion", async () => {
    const subject = fixture();
    await subject.workflow.signIn("apple");
    assert.deepEqual(await subject.workflow.deleteAccount(), {
        kind: "deleted",
        appleRevocationPending: false,
    });
    assert.deepEqual(subject.calls, [
        "sign-in:apple",
        "fresh-token",
        "prepare",
        "revoke-apple",
        "delete-firebase",
        "sign-out",
    ]);
});

test("Apple revocation failure is disclosed but does not strand Firebase deletion", async () => {
    const subject = fixture({
        async revokeAppleAccessToken() {
            subject.calls.push("revoke-apple");
            throw new Error("provider unavailable");
        },
    });
    await subject.workflow.signIn("apple");
    assert.deepEqual(await subject.workflow.deleteAccount(), {
        kind: "deleted",
        appleRevocationPending: true,
    });
    assert.deepEqual(subject.calls.slice(-3), ["revoke-apple", "delete-firebase", "sign-out"]);
});

test("missing Apple access token requires manual follow-up", async () => {
    const subject = fixture({
        async signIn(provider) {
            subject.calls.push(`sign-in:${provider}`);
            return { accountStatus: "existing", user: subject.user, appleAccessToken: null };
        },
    });
    await subject.workflow.signIn("apple");
    const result = await subject.workflow.deleteAccount();
    assert.equal(result.appleRevocationPending, true);
    assert.equal(subject.calls.includes("revoke-apple"), false);
});

test("wrong provider new account is discarded and never reaches backend", async () => {
    const subject = fixture({
        async signIn(provider) {
            subject.calls.push(`sign-in:${provider}`);
            return { accountStatus: "new", user: subject.user };
        },
    });
    assert.deepEqual(await subject.workflow.signIn("google"), {
        kind: "account-not-found",
        appleRevocationPending: false,
    });
    assert.deepEqual(subject.calls, ["sign-in:google", "discard-new"]);
    assert.equal(subject.workflow.hasVerifiedSession, false);
    await assert.rejects(
        subject.workflow.deleteAccount(),
        (error) => error instanceof DeletionWorkflowError && error.code === "sign-in-required",
    );
});

test("wrong Apple account reports incomplete provider revocation without touching backend", async () => {
    const subject = fixture({
        async signIn(provider) {
            subject.calls.push(`sign-in:${provider}`);
            return {
                accountStatus: "new",
                user: subject.user,
                appleAccessToken: "new-apple-token",
            };
        },
        async discardNewAccount() {
            subject.calls.push("discard-new");
            return { appleRevocationPending: true };
        },
    });
    assert.deepEqual(await subject.workflow.signIn("apple"), {
        kind: "account-not-found",
        appleRevocationPending: true,
    });
    assert.deepEqual(subject.calls, ["sign-in:apple", "discard-new"]);
    assert.equal(subject.workflow.hasVerifiedSession, false);
});

test("failed wrong-account cleanup never proceeds or reports the intended account deleted", async () => {
    const subject = fixture({
        async signIn(provider) {
            subject.calls.push(`sign-in:${provider}`);
            return { accountStatus: "new", user: subject.user };
        },
        async discardNewAccount() {
            subject.calls.push("discard-new");
            throw new Error("Firebase unavailable");
        },
    });
    await assert.rejects(
        subject.workflow.signIn("google"),
        (error) => error instanceof DeletionWorkflowError
            && error.code === "new-account-cleanup-failed",
    );
    assert.deepEqual(subject.calls, ["sign-in:google", "discard-new", "sign-out"]);
    assert.equal(subject.workflow.hasVerifiedSession, false);
});

test("failed wrong Apple cleanup preserves manual revocation guidance", async () => {
    const subject = fixture({
        async signIn(provider) {
            subject.calls.push(`sign-in:${provider}`);
            return { accountStatus: "new", user: subject.user, appleAccessToken: "apple-token" };
        },
        async discardNewAccount() {
            subject.calls.push("discard-new");
            throw new DeletionWorkflowError("new-account-cleanup-failed", {
                appleRevocationPending: true,
            });
        },
    });
    await assert.rejects(
        subject.workflow.signIn("apple"),
        (error) => error instanceof DeletionWorkflowError
            && error.code === "new-account-cleanup-failed"
            && error.appleRevocationPending,
    );
    assert.deepEqual(subject.calls, ["sign-in:apple", "discard-new", "sign-out"]);
});

test("unknown account status fails closed and clears Firebase sign-in", async () => {
    const subject = fixture({
        async signIn(provider) {
            subject.calls.push(`sign-in:${provider}`);
            return { accountStatus: "unknown", user: subject.user };
        },
    });
    await assert.rejects(
        subject.workflow.signIn("google"),
        (error) => error instanceof DeletionWorkflowError && error.code === "account-status-unknown",
    );
    assert.deepEqual(subject.calls, ["sign-in:google", "sign-out"]);
    assert.equal(subject.workflow.hasVerifiedSession, false);
});

test("backend rejection never revokes provider or deletes Firebase account", async () => {
    const subject = fixture({
        async prepareDeletion() {
            subject.calls.push("prepare");
            return { status: 503 };
        },
    });
    await subject.workflow.signIn("apple");
    await assert.rejects(
        subject.workflow.deleteAccount(),
        (error) => error instanceof DeletionWorkflowError
            && error.code === "backend-rejected"
            && error.status === 503,
    );
    assert.deepEqual(subject.calls, ["sign-in:apple", "fresh-token", "prepare"]);
    assert.equal(subject.workflow.hasVerifiedSession, true);
});

test("Firebase deletion failure is partial, never reported as complete, and requires a fresh sign-in", async () => {
    const subject = fixture({
        async deleteFirebaseUser() {
            subject.calls.push("delete-firebase");
            throw new Error("Firebase unavailable");
        },
    });
    await subject.workflow.signIn("google");
    await assert.rejects(
        subject.workflow.deleteAccount(),
        (error) => error instanceof DeletionWorkflowError
            && error.code === "firebase-delete-failed"
            && error.preparationCompleted,
    );
    assert.deepEqual(subject.calls, [
        "sign-in:google",
        "fresh-token",
        "prepare",
        "delete-firebase",
        "sign-out",
    ]);
    assert.equal(subject.workflow.hasVerifiedSession, false);
});

test("concurrent operations are rejected without starting a second provider flow", async () => {
    let releaseSignIn;
    const subject = fixture({
        signIn(provider) {
            subject.calls.push(`sign-in:${provider}`);
            return new Promise((resolve) => {
                releaseSignIn = () => resolve({
                    accountStatus: "existing",
                    user: subject.user,
                    appleAccessToken: null,
                });
            });
        },
    });
    const first = subject.workflow.signIn("google");
    await assert.rejects(
        subject.workflow.signIn("apple"),
        (error) => error instanceof DeletionWorkflowError && error.code === "operation-in-progress",
    );
    releaseSignIn();
    await first;
    assert.deepEqual(subject.calls, ["sign-in:google"]);
});
