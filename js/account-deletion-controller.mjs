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
            || hostname === "127.0.0.1"
            || hostname === "::1"
            || hostname === "[::1]");
    if (!isLoopback) {
        return null;
    }
    const backendHost = hostname === "::1" || hostname === "[::1]" ? "[::1]" : hostname;
    return `http://${backendHost}:8080/v1/account`;
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
                    await dependencies.signOut();
                    session = null;
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
