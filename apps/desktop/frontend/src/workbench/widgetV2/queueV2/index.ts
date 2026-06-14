// Compatibility/smoke exports for the WidgetV2 Queue shell. The current product
// Agent Queue route is WidgetHost -> AgentQueuePlaceholderWidget ->
// AgentQueueV2Board, not QueueV2Widget.
export { QueueV2ActivityStream } from "./QueueV2ActivityStream";
export { QueueV2Board } from "./QueueV2Board";
export { QueueV2LeftRail } from "./QueueV2LeftRail";
export { QueueV2TaskCard } from "./QueueV2TaskCard";
export { QueueV2TopBar } from "./QueueV2TopBar";
export { QueueV2Widget as QueueV2SmokeCompatWidget } from "./QueueV2Widget";
