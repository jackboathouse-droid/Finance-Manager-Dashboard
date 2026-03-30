import Stripe from "stripe";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { getStripeSync, getUncachableStripeClient } from "./stripeClient";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
          "Received type: " + typeof payload + ". " +
          "This usually means express.json() parsed the body before reaching this handler. " +
          "FIX: Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }

    // Delegate to stripe-replit-sync for DB sync first
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Additionally handle plan state changes explicitly
    let event: Stripe.Event;
    try {
      const stripe = await getUncachableStripeClient();
      // Re-construct the event from raw payload to get typed event data
      // We parse without verification here since sync already verified above
      event = JSON.parse(payload.toString()) as Stripe.Event;
    } catch (err) {
      logger.warn({ err }, "Could not parse webhook event for plan sync; skipping plan update");
      return;
    }

    try {
      await WebhookHandlers.handlePlanEvent(event);
    } catch (err) {
      // Log but don't rethrow — stripe-replit-sync already succeeded
      logger.error({ err, eventType: event.type }, "Error in plan-sync webhook handler");
    }
  }

  /**
   * Explicitly update users.plan based on subscription lifecycle events.
   * This ensures plan state is always current even if /billing/status hasn't been polled.
   */
  private static async handlePlanEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        const userId = session.metadata?.userId;

        if (!customerId) {
          logger.warn("checkout.session.completed: no customer id");
          break;
        }

        // Update plan to pro and persist stripe_customer_id
        if (userId) {
          await db
            .update(usersTable)
            .set({ plan: "pro", stripe_customer_id: customerId })
            .where(eq(usersTable.id, Number(userId)));
          logger.info({ userId, customerId }, "Plan upgraded to pro via checkout.session.completed");
        } else {
          // Fall back to customer ID lookup
          await db
            .update(usersTable)
            .set({ plan: "pro" })
            .where(eq(usersTable.stripe_customer_id, customerId));
          logger.info({ customerId }, "Plan upgraded to pro via checkout.session.completed (customer lookup)");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        await db
          .update(usersTable)
          .set({ plan: "free" })
          .where(eq(usersTable.stripe_customer_id, customerId));
        logger.info({ customerId }, "Plan downgraded to free via customer.subscription.deleted");
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        const newPlan = subscription.status === "active" ? "pro" : "free";
        await db
          .update(usersTable)
          .set({ plan: newPlan })
          .where(eq(usersTable.stripe_customer_id, customerId));
        logger.info({ customerId, newPlan }, "Plan updated via customer.subscription.updated");
        break;
      }

      default:
        break;
    }
  }
}
