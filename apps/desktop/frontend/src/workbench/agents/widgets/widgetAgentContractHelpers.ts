import {
  createWidgetCapabilityContract,
  type HobitWidgetCapabilityContract,
} from "./hobitWidgetAgentContract";

export type WidgetCapabilityInput = Omit<
  HobitWidgetCapabilityContract,
  "availability" | "restricted"
> &
  Partial<Pick<HobitWidgetCapabilityContract, "restricted">>;

export type WidgetUnavailableCapabilityInput = WidgetCapabilityInput & {
  unavailableReason: string;
};

export function widgetCapability(
  capability: WidgetCapabilityInput | WidgetUnavailableCapabilityInput,
) {
  if ("unavailableReason" in capability) {
    return unavailableWidgetCapability(capability);
  }

  return availableWidgetCapability(capability);
}

export function availableWidgetCapability(capability: WidgetCapabilityInput) {
  return createWidgetCapabilityContract({
    ...capability,
    availability: { status: "available" },
    restricted: capability.restricted ?? false,
  });
}

export function unavailableWidgetCapability({
  unavailableReason,
  ...capability
}: WidgetUnavailableCapabilityInput) {
  return createWidgetCapabilityContract({
    ...capability,
    availability: { status: "unavailable", unavailableReason },
    restricted: capability.restricted ?? false,
  });
}
