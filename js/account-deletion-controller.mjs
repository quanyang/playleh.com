export class DeletionWorkflowError extends Error {
    constructor(code, options = {}) {
        super(code);
        this.name = "DeletionWorkflowError";
        this.code = code;
        this.status = options.status ?? null;
        this.preparationCompleted = options.preparationCompleted ?? false;
        this.appleRevocationPending = options.appleRevocationPending ?? false;
    }
}

export function deletionEndpointFor(pageLocation) {
    if (pageLocation?.origin === "https://playleh.com") {
        return "https://mahjong-go.playleh.com/v1/account";
    }
    const hostname = pageLocation?.hostname;
    const isLoopback = pageLocation?.protocol === "http:"
        && (hostname === "localhost"
            || hostname === "127.0.0.1");
    if (!isLoopback) {
        return null;
    }
    return `http://${hostname}:8080/v1/account`;
}

export async function fetchWithTimeout(
    fetchImplementation,
    input,
    init = {},
    timeoutMilliseconds = 30_000,
    runtime = {},
) {
    const AbortControllerImplementation = runtime.AbortController
        ?? globalThis.AbortController;
    const setTimer = runtime.setTimeout ?? globalThis.setTimeout;
    const clearTimer = runtime.clearTimeout ?? globalThis.clearTimeout;

    if (typeof AbortControllerImplementation !== "function"
        || typeof setTimer !== "function"
        || typeof clearTimer !== "function") {
        throw new DeletionWorkflowError("request-timeout");
    }

    const controller = new AbortControllerImplementation();
    let timedOut = false;
    const timeoutID = setTimer(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMilliseconds);

    try {
        return await fetchImplementation(input, {
            ...init,
            signal: controller.signal,
        });
    } catch (error) {
        if (timedOut) {
            throw new DeletionWorkflowError("request-timeout");
        }
        throw error;
    } finally {
        clearTimer(timeoutID);
    }
}

export function diagnosticCodeFor(error) {
    if (error instanceof DeletionWorkflowError
        && /^[a-z0-9-]+$/.test(error.code)) {
        return `workflow/${error.code}`;
    }

    const externalCode = typeof error?.code === "string" ? error.code : "";
    if (/^auth\/[a-z0-9-]+$/.test(externalCode)) {
        return externalCode;
    }

    const errorName = typeof error?.name === "string" ? error.name : "";
    if (/^[A-Za-z][A-Za-z0-9]*Error$/.test(errorName)) {
        return errorName;
    }

    return "unknown";
}

export function createDeletionWorkflow(dependencies) {
    let session = null;
    let busy = false;

    async function exclusively(operation) {
        if (busy) {
            throw new DeletionWorkflowError("operation-in-progress");
        }
        busy = true;
        try {
            return await operation();
        } finally {
            busy = false;
        }
    }

    return {
        get hasVerifiedSession() {
            return session !== null;
        },

        async signIn(provider) {
            return exclusively(async () => {
                if (provider !== "google" && provider !== "apple") {
                    throw new DeletionWorkflowError("unsupported-provider");
                }
                if (session !== null) {
                    session = null;
                    await bestEffortSignOut(dependencies);
                }
                const candidate = await dependencies.signIn(provider);
                if (candidate.accountStatus === "new") {
                    let cleanup;
                    try {
                        cleanup = await dependencies.discardNewAccount(candidate);
                    } catch (error) {
                        session = null;
                        await bestEffortSignOut(dependencies);
                        throw new DeletionWorkflowError("new-account-cleanup-failed", {
                            appleRevocationPending: error instanceof DeletionWorkflowError
                                && error.appleRevocationPending,
                        });
                    }
                    return {
                        kind: "account-not-found",
                        appleRevocationPending: cleanup.appleRevocationPending === true,
                    };
                }
                if (candidate.accountStatus !== "existing" || candidate.user == null) {
                    await bestEffortSignOut(dependencies);
                    throw new DeletionWorkflowError("account-status-unknown");
                }
                session = {
                    provider,
                    user: candidate.user,
                    appleAccessToken: candidate.appleAccessToken ?? null,
                };
                return { kind: "ready", provider };
            });
        },

        async deleteAccount() {
            return exclusively(async () => {
                if (session === null) {
                    throw new DeletionWorkflowError("sign-in-required");
                }
                const activeSession = session;
                const idToken = await dependencies.getFreshIDToken(activeSession);
                const response = await dependencies.prepareDeletion(idToken);
                if (response.status !== 204) {
                    throw new DeletionWorkflowError("backend-rejected", { status: response.status });
                }

                let appleRevocationPending = false;
                if (activeSession.provider === "apple") {
                    if (activeSession.appleAccessToken == null) {
                        appleRevocationPending = true;
                    } else {
                        try {
                            await dependencies.revokeAppleAccessToken(activeSession.appleAccessToken);
                        } catch {
                            appleRevocationPending = true;
                        }
                    }
                }

                try {
                    await dependencies.deleteFirebaseUser(activeSession.user);
                } catch {
                    session = null;
                    await bestEffortSignOut(dependencies);
                    throw new DeletionWorkflowError("firebase-delete-failed", {
                        preparationCompleted: true,
                        appleRevocationPending,
                    });
                }
                session = null;
                await bestEffortSignOut(dependencies);
                return { kind: "deleted", appleRevocationPending };
            });
        },

        async reset() {
            return exclusively(async () => {
                session = null;
                await bestEffortSignOut(dependencies);
            });
        },
    };
}

async function bestEffortSignOut(dependencies) {
    try {
        await dependencies.signOut();
    } catch {
        // The in-memory session is already discarded. A sign-out failure cannot
        // convert a failed deletion into a successful one or retain credentials here.
    }
}
