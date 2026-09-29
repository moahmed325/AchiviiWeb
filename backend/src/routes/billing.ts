import { Router, Request, Response } from "express";
import { getAuthUser } from "./auth.js";
import { createLemonSqueezyCheckout, CheckoutInterval } from "../lib/billing/lemonSqueezyCheckout.js";
import { hasProEntitlement } from "../lib/billing/entitlement.js";
import { getBillingAccountState } from "../lib/billing/accountState.js";
import { reconcileUserSubscription } from "../lib/billing/lemonSqueezyReconciliation.js";

export const billingRouter = Router();

export const entitlementHandler = async (req: Request, res: Response): Promise<void> => {
  const user = await getAuthUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized. Please sign in." }); return; }
  try {
    const entitled = await hasProEntitlement(user.id);
    res.status(200).json({ plan: entitled ? "pro" : "free", entitled });
  } catch (error) {
    console.error("Billing entitlement error:", error);
    res.status(500).json({ error: "Unable to load billing status. Please try again." });
  }
};

export const accountStateHandler = async (req: Request, res: Response): Promise<void> => {
  const user = await getAuthUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized. Please sign in." }); return; }
  try {
    res.status(200).json(await getBillingAccountState(user.id));
  } catch (error) {
    console.error("Billing account state error:", error);
    res.status(500).json({ error: "Unable to load billing status. Please try again." });
  }
};
export const reconcileHandler = async (req: Request, res: Response): Promise<void> => {
  const user = await getAuthUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized. Please sign in." }); return; }
  try {
    const result = await reconcileUserSubscription(user.id);
    if (!result.reconciled && result.reason === "provider_unavailable") { res.status(503).json({ ...result, error: "Billing provider unavailable. Local entitlement was not changed." }); return; }
    res.status(200).json(result);
  } catch (error) {
    console.error("Billing reconciliation error:", error);
    res.status(502).json({ reconciled: false, error: "Unable to reconcile billing state." });
  }
};
export const checkoutHandler = async (req: Request, res: Response): Promise<void> => {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized. Please sign in." });
    return;
  }

  const requestedInterval = req.body?.interval;
  if (requestedInterval !== undefined && requestedInterval !== "monthly" && requestedInterval !== "yearly") {
    res.status(400).json({ error: "Billing interval must be monthly or yearly." });
    return;
  }

  const interval: CheckoutInterval = requestedInterval === "yearly" ? "yearly" : "monthly";

  try {
    const checkout = await createLemonSqueezyCheckout({
      userId: user.id,
      email: user.email,
      interval,
    });

    res.status(200).json(checkout);
  } catch (error: unknown) {
    console.error("Billing checkout error:", error);
    res.status(502).json({ error: "Unable to create checkout. Please try again." });
  }
};

billingRouter.get("/entitlement", entitlementHandler);
billingRouter.post("/reconcile", reconcileHandler);
billingRouter.post("/checkout", checkoutHandler);

