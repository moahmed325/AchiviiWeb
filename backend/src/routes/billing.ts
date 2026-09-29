import { Router, Request, Response } from "express";
import { getAuthUser } from "./auth.js";
import { createLemonSqueezyCheckout, CheckoutInterval } from "../lib/billing/lemonSqueezyCheckout.js";

export const billingRouter = Router();

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

billingRouter.post("/checkout", checkoutHandler);
