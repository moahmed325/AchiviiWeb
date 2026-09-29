export type InternalSubscriptionState =
  | "ACTIVE"
  | "CANCELLED_ENDING"
  | "PAST_DUE_RECOVERY"
  | "UNPAID"
  | "PAUSED"
  | "EXPIRED"
  | "UNKNOWN";

export const mapLemonSqueezyStatus = (
  providerStatus: string,
  endsAt: string | null | undefined,
  renewsAt: string | null | undefined,
): InternalSubscriptionState => {
  switch (providerStatus) {
    case "active":
    case "on_trial":
      return "ACTIVE";
    case "cancelled":
      return endsAt && new Date(endsAt) > new Date() ? "CANCELLED_ENDING" : "EXPIRED";
    case "past_due":
      return "PAST_DUE_RECOVERY";
    case "unpaid":
      return "UNPAID";
    case "paused":
      return "PAUSED";
    case "expired":
      return "EXPIRED";
    default:
      return "UNKNOWN";
  }
};

export const periodEndForState = (
  state: InternalSubscriptionState,
  renewsAt: string | null | undefined,
  endsAt: string | null | undefined,
): Date | null => {
  const value = state === "CANCELLED_ENDING" ? endsAt ?? renewsAt : renewsAt ?? endsAt;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
