# QueueV2 Compatibility Surface

The active Agent Queue product route is the saved-widget-compatible path:

```text
WidgetHost -> AgentQueuePlaceholderWidget -> AgentQueueV2Board
```

`QueueV2Widget` in this folder is retained for smoke, regression, and
compatibility coverage of WidgetV2 shell composition. It is not the current
product-rendered Agent Queue widget and must not be promoted to product routing
without an explicit replacement block that preserves the `agent-queue` widget
identity, component key, IPC contracts, storage/schema, and Queue runtime
semantics.

Shared QueueV2 board/details components in this folder may still be used by the
active root `AgentQueueV2Board` product path.

## Widget domain folder layout

- components: product UI components
- model: pure view/domain model and labels
- hooks: React hooks
- actions: action item construction and availability
- popups: widget-specific product popups
- debug: widget-specific debug/developer content
