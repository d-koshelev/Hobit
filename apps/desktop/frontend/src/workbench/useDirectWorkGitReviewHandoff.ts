import { useRef, useState } from "react";

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

export function useDirectWorkGitReviewHandoff(
  hasGitWidget: boolean,
): DirectWorkGitReviewHandoff {
  const requestIdRef = useRef(0);
  const [request, setRequest] = useState<DirectWorkGitReviewRequest | null>(
    null,
  );
  const [status, setStatus] = useState<DirectWorkGitReviewStatus | null>(null);

  function requestReview(requestInput: DirectWorkGitReviewRequestInput) {
    const repositoryRoot = requestInput.repositoryRoot.trim();

    if (!repositoryRoot || !hasGitWidget) {
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
      requestId: nextRequest.id,
      sourceWidgetInstanceId: nextRequest.sourceWidgetInstanceId,
      state: "pending",
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
