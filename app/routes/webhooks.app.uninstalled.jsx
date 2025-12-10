import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Update shop record to mark as uninstalled
  await db.shop.updateMany({
    where: { shop },
    data: {
      isActive: false,
      uninstalledAt: new Date(),
      accessToken: null,
    },
  });

  return new Response();
};
