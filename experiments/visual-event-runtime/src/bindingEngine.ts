import type {
  BindingRule,
  SceneRuntimeState,
  VisualAction,
  VisualEvent,
} from "./contracts";

function getValueAtPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, source);
}

function matchesExpectedValue(actual: unknown, expected: unknown) {
  if (Array.isArray(expected)) {
    return expected.some((value) => Object.is(actual, value));
  }

  return Object.is(actual, expected);
}

export function doesRuleMatchEvent(rule: BindingRule, event: VisualEvent) {
  return Object.entries(rule.when).every(([path, expected]) =>
    matchesExpectedValue(getValueAtPath(event, path), expected),
  );
}

export function getMatchingBindingRules(
  event: VisualEvent,
  rules: BindingRule[],
) {
  return rules.filter((rule) => doesRuleMatchEvent(rule, event));
}

export function getVisualActionsForEvent(
  event: VisualEvent,
  rules: BindingRule[],
  _currentState: SceneRuntimeState,
) {
  return getMatchingBindingRules(event, rules).flatMap((rule) =>
    rule.actions.map((action) => ({
      action,
      rule,
    })),
  );
}

export function describeAction(action: VisualAction) {
  switch (action.kind) {
    case "setState":
      return `${action.targetId} state -> ${action.state}`;
    case "showObject":
      return `show ${action.targetId}`;
    case "hideObject":
      return `hide ${action.targetId}`;
    case "playAnimation":
      return `${action.targetId} plays ${action.animationId}`;
    case "spawnEffect":
      return `spawn ${action.presetId}${action.targetId ? ` near ${action.targetId}` : ""}`;
    case "spawnObject":
      return `spawn ${action.objectId} from ${action.presetId}`;
    case "spawnFromObject":
      return `spawn ${action.objectId} from ${action.sourceObjectId}`;
    case "removeObject":
      return `remove ${action.targetId ?? action.tag ?? action.metadataSelector?.key ?? "selection"}`;
    case "setProperty":
      return `${action.targetId} ${action.property} = ${String(action.value)}`;
    case "moveTo":
      return `${action.targetId} moves to ${action.to.x},${action.to.y}`;
    case "moveToObject":
      return `${action.targetId} moves to ${action.targetObjectId}`;
    case "moveAlongPath":
      return `${action.targetId} follows ${action.path.length} path points`;
    case "orbitAround":
      return `${action.targetId} orbits ${action.targetObjectId}`;
    case "attachToObject":
      return `${action.targetId} attaches to ${action.targetObjectId}`;
    case "detachFromObject":
      return `${action.targetId} detaches`;
    case "despawnAtObject":
      return `${action.targetId} despawns at ${action.targetObjectId}`;
    case "spawnAttachedEffect":
      return `spawn attached ${action.presetId} on ${action.targetId}`;
    case "showRouteTrail":
      return `show route trail for ${action.targetId}`;
    case "hideRouteTrail":
      return `hide route trail for ${action.targetId}`;
  }
}
