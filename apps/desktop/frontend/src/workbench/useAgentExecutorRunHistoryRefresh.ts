import { useState } from "react";

import type {
  DirectWorkValidationProfile,
  RunDirectWorkValidationResponse,
} from "../workspace/types";
import type { WidgetInstanceId } from "./types";

type DirectWorkValidationRunner = (
  widgetInstanceId: WidgetInstanceId,
  request: {
    repoRoot: string;
    validationProfile: DirectWorkValidationProfile;
  },
) => Promise<RunDirectWorkValidationResponse | null>;

export function useAgentExecutorRunHistoryRefresh(
  onRunDirectWorkValidation?: DirectWorkValidationRunner,
) {
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);

  function refreshRunHistory() {
    setHistoryRefreshToken((currentToken) => currentToken + 1);
  }

  async function runDirectWorkValidationAndRefresh(
    widgetInstanceId: WidgetInstanceId,
    request: {
      repoRoot: string;
      validationProfile: DirectWorkValidationProfile;
    },
  ) {
    if (!onRunDirectWorkValidation) {
      return null;
    }

    const response = await onRunDirectWorkValidation(widgetInstanceId, request);

    if (response) {
      refreshRunHistory();
    }

    return response;
  }

  return {
    historyRefreshToken,
    refreshRunHistory,
    runDirectWorkValidationAndRefresh:
      onRunDirectWorkValidation ? runDirectWorkValidationAndRefresh : undefined,
  };
}
