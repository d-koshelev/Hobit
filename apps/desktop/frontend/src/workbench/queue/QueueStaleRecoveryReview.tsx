import { useCallback, useEffect, useId, useState } from "react";

import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import {
  listStaleQueueLocalRuns,
  recoverStaleQueueLocalRunFailed,
} from "../../workspace/tauriAgentQueueApi";
import type { QueueStaleRunCandidateSummary } from "../../workspace/types";

type QueueRefreshController = {
  refreshAfterExternalMutation?: (queueItemId?: string | null) => Promise<void>;
};

type QueueStaleRecoveryReviewProps = {
  queue?: QueueRefreshController | null;
  workspaceId?: string | null;
};

type ReviewStatus = {
  message: string;
  tone: "error" | "success";
};

export const QUEUE_STALE_RECOVERY_ACTOR_ID = "operator";
export const QUEUE_STALE_RECOVERY_BACKEND_CONFIRMATION_TOKEN =
  "recover-stale-queue-local-run";
export const QUEUE_STALE_RECOVERY_REASON =
  "operator confirmed stale queue_local run from Queue UI";

export function queueStaleRecoveryIdentityConfirmation(
  candidate: QueueStaleRunCandidateSummary,
) {
  return `recover ${candidate.queueItemId} ${candidate.runId} ${candidate.runLinkId}`;
}

export function QueueStaleRecoveryReview({
  queue,
  workspaceId,
}: QueueStaleRecoveryReviewProps) {
  const confirmationInputBaseId = useId();
  const [candidates, setCandidates] = useState<QueueStaleRunCandidateSummary[]>(
    [],
  );
  const [confirmationByCandidate, setConfirmationByCandidate] = useState<
    Record<string, string>
  >({});
  const [activeCandidateKey, setActiveCandidateKey] = useState<string | null>(
    null,
  );
  const [recoveringCandidateKey, setRecoveringCandidateKey] = useState<
    string | null
  >(null);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(null);

  const refreshStaleCandidates = useCallback(async () => {
    if (!workspaceId || !isTauriDesktopRuntime()) {
      setCandidates([]);
      setActiveCandidateKey(null);
      return;
    }

    try {
      const nextCandidates = await listStaleQueueLocalRuns({ workspaceId });
      setCandidates(nextCandidates);
      if (nextCandidates.length === 0) {
        setActiveCandidateKey(null);
      }
    } catch (error) {
      setReviewStatus({
        message:
          error instanceof Error
            ? error.message
            : "Stale Queue recovery candidates could not be loaded.",
        tone: "error",
      });
    }
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;

    async function loadCandidates() {
      if (!workspaceId || !isTauriDesktopRuntime()) {
        if (!cancelled) {
          setCandidates([]);
          setActiveCandidateKey(null);
        }
        return;
      }

      try {
        const nextCandidates = await listStaleQueueLocalRuns({ workspaceId });
        if (!cancelled) {
          setCandidates(nextCandidates);
          if (nextCandidates.length === 0) {
            setActiveCandidateKey(null);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setReviewStatus({
            message:
              error instanceof Error
                ? error.message
                : "Stale Queue recovery candidates could not be loaded.",
            tone: "error",
          });
        }
      }
    }

    void loadCandidates();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function recoverCandidate(candidate: QueueStaleRunCandidateSummary) {
    if (!workspaceId || recoveringCandidateKey) {
      return;
    }

    const candidateKey = staleCandidateKey(candidate);
    const requiredConfirmation =
      queueStaleRecoveryIdentityConfirmation(candidate);
    if (confirmationByCandidate[candidateKey] !== requiredConfirmation) {
      return;
    }

    setRecoveringCandidateKey(candidateKey);
    setReviewStatus(null);
    try {
      await recoverStaleQueueLocalRunFailed({
        actorId: QUEUE_STALE_RECOVERY_ACTOR_ID,
        confirmationToken: QUEUE_STALE_RECOVERY_BACKEND_CONFIRMATION_TOKEN,
        queueItemId: candidate.queueItemId,
        reason: QUEUE_STALE_RECOVERY_REASON,
        runId: candidate.runId,
        runLinkId: candidate.runLinkId,
        workspaceId,
      });
      await queue?.refreshAfterExternalMutation?.(candidate.queueItemId);
      await refreshStaleCandidates();
      setActiveCandidateKey(null);
      setConfirmationByCandidate((current) => {
        const next = { ...current };
        delete next[candidateKey];
        return next;
      });
      setReviewStatus({
        message: `Recovered ${shortId(candidate.queueItemId)} as failed.`,
        tone: "success",
      });
    } catch (error) {
      setReviewStatus({
        message:
          error instanceof Error
            ? error.message
            : "Stale Queue recovery failed.",
        tone: "error",
      });
    } finally {
      setRecoveringCandidateKey(null);
    }
  }

  if (candidates.length === 0 && reviewStatus?.tone !== "success") {
    return null;
  }

  return (
    <section
      aria-label="Stale Queue recovery review"
      className="agent-queue-stale-recovery"
    >
      <div className="agent-queue-stale-recovery-header">
        <div>
          <p className="agent-queue-section-title">
            Stale Queue run review
          </p>
          <p className="agent-queue-section-copy">
            Backend reported queue_local runs that require operator recovery.
          </p>
        </div>
        {candidates.length > 0 ? (
          <Badge variant="warning">
            {candidates.length === 1
              ? "1 candidate"
              : `${candidates.length.toString()} candidates`}
          </Badge>
        ) : (
          <Badge variant="success">Recovered</Badge>
        )}
      </div>
      {reviewStatus ? (
        <p
          className={`agent-queue-stale-recovery-message agent-queue-stale-recovery-message-${reviewStatus.tone}`}
          role={reviewStatus.tone === "error" ? "alert" : "status"}
        >
          {reviewStatus.message}
        </p>
      ) : null}
      {candidates.length > 0 ? (
        <div className="agent-queue-stale-recovery-list">
          {candidates.map((candidate, index) => {
          const candidateKey = staleCandidateKey(candidate);
          const requiredConfirmation =
            queueStaleRecoveryIdentityConfirmation(candidate);
          const confirmationDraft = confirmationByCandidate[candidateKey] ?? "";
          const isActive = activeCandidateKey === candidateKey;
          const isRecovering = recoveringCandidateKey === candidateKey;
          const canRecover = confirmationDraft === requiredConfirmation;
          const inputId = `${confirmationInputBaseId}-${index.toString()}`;

            return (
              <article
                className="agent-queue-stale-recovery-item"
                key={candidateKey}
              >
                <div className="agent-queue-stale-recovery-summary">
                  <div className="agent-queue-stale-recovery-title-row">
                    <strong title={candidate.taskTitle}>
                      {candidate.taskTitle || "Untitled Queue task"}
                    </strong>
                    <Badge variant="warning">{candidate.reasonCode}</Badge>
                  </div>
                  <dl className="agent-queue-stale-recovery-facts">
                    <div>
                      <dt>Queue item</dt>
                      <dd title={candidate.queueItemId}>
                        {shortId(candidate.queueItemId)}
                      </dd>
                    </div>
                    <div>
                      <dt>Run link</dt>
                      <dd title={candidate.runLinkId}>
                        {shortId(candidate.runLinkId)}
                      </dd>
                    </div>
                    <div>
                      <dt>Started</dt>
                      <dd title={candidate.startedAt}>
                        {candidate.startedAt} /{" "}
                        {formatAge(candidate.ageSeconds)}
                      </dd>
                    </div>
                    <div>
                      <dt>Executor target</dt>
                      <dd title={candidate.executorWidgetId}>
                        {candidate.executorWidgetId}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="agent-queue-stale-recovery-action">
                  {isActive ? (
                    <div className="agent-queue-stale-recovery-confirmation">
                      <p>
                        Type <code>{requiredConfirmation}</code> to mark this
                        exact task/run failed.
                      </p>
                      <label htmlFor={inputId}>Confirmation</label>
                      <input
                        autoComplete="off"
                        id={inputId}
                        onChange={(event) =>
                          setConfirmationByCandidate((current) => ({
                            ...current,
                            [candidateKey]: event.target.value,
                          }))
                        }
                        value={confirmationDraft}
                      />
                      <div className="agent-queue-stale-recovery-confirmation-actions">
                        <Button
                          disabled={isRecovering}
                          onClick={() => {
                            setActiveCandidateKey(null);
                            setConfirmationByCandidate((current) => ({
                              ...current,
                              [candidateKey]: "",
                            }));
                          }}
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                        <Button
                          disabled={!canRecover || isRecovering}
                          onClick={() => void recoverCandidate(candidate)}
                          variant="danger"
                        >
                          {isRecovering ? "Recovering" : "Mark failed"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => {
                        setActiveCandidateKey(candidateKey);
                        setReviewStatus(null);
                      }}
                      variant="secondary"
                    >
                      Review recovery
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function staleCandidateKey(candidate: QueueStaleRunCandidateSummary) {
  return `${candidate.queueItemId}:${candidate.runId}:${candidate.runLinkId}`;
}

function shortId(value: string) {
  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 7)}...${value.slice(-4)}`;
}

function formatAge(ageSeconds: number) {
  if (!Number.isFinite(ageSeconds) || ageSeconds < 60) {
    return "<1m old";
  }

  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) {
    return `${minutes.toString()}m old`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours.toString()}h old`;
  }

  const days = Math.floor(hours / 24);
  return `${days.toString()}d old`;
}

function isTauriDesktopRuntime() {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}
