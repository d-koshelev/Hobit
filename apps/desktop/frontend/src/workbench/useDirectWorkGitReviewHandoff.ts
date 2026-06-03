import { useRef, useState } from "react";

import { getWorkspaceGitStatus } from "../workspace/workspaceGitApi";
import type {
  DirectWorkGitReviewRequest,
  DirectWorkGitReviewRequestInput,
  DirectWorkGitReviewStatus,
} from "./types";

export type DirectWorkGitReviewHandoff = {
  request: DirectWorkGitReviewRequest | null;
  requestReview: (request: DirectWorkGitReviewRequestInput) => void;
  status: DirectWorkGitReviewStatus | null;
  updateStatus: (status: DirectWorkGitReviewStatus) => void;
};

export function useDirectWorkGitReviewHandoff(): DirectWorkGitReviewHandoff {
  const requestIdRef = useRef(0);
  const [request, setRequest] = useState<DirectWorkGitReviewRequest | null>(
    null,
  );
  const [status, setStatus] = useState<DirectWorkGitReviewStatus | null>(null);

  function requestReview(requestInput: DirectWorkGitReviewRequestInput) {
    const repositoryRoot = requestInput.repositoryRoot.trim();

    if (!repositoryRoot) {
      setRequest(null);
      setStatus(null);
      return;
    }

    const nextRequest = {
      id: ++requestIdRef.current,
      repositoryRoot,
      sourceWidgetInstanceId: requestInput.sourceWidgetInstanceId,
    };

    setRequest(nextRequest);
    setStatus({
      repositoryRoot: nextRequest.repositoryRoot,
      repositoryStatus: null,
      requestId: nextRequest.id,
      sourceWidgetInstanceId: nextRequest.sourceWidgetInstanceId,
      state: "pending",
    });

    void getWorkspaceGitStatus({ repoRoot: repositoryRoot })
      .then((repositoryStatus) => {
        updateStatus({
          repositoryRoot: nextRequest.repositoryRoot,
          repositoryStatus,
          requestId: nextRequest.id,
          sourceWidgetInstanceId: nextRequest.sourceWidgetInstanceId,
          state: "completed",
        });
      })
      .catch((error: unknown) => {
        updateStatus({
          errorMessage: errorToMessage(error),
          repositoryRoot: nextRequest.repositoryRoot,
          repositoryStatus: null,
          requestId: nextRequest.id,
          sourceWidgetInstanceId: nextRequest.sourceWidgetInstanceId,
          state: "failed",
        });
      });
  }

  function updateStatus(nextStatus: DirectWorkGitReviewStatus) {
    setStatus((currentStatus) => {
      if (currentStatus && currentStatus.requestId !== nextStatus.requestId) {
        return currentStatus;
      }

      return nextStatus;
    });
  }

  return {
    request,
    requestReview,
    status,
    updateStatus,
  };
}

function errorToMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Git status read failed.";
}
