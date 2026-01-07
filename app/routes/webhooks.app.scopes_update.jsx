import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;

  if (session) {
    await db.session.update({
      where: {
        id: session.id,
      },
      data: {
        scope: current.toString(),
      },
    });

    // Also update shop record with new scopes
    await db.shop.updateMany({
      where: { shop },
      data: {
        scope: current.toString(),
        updatedAt: new Date(),
      },
    });
  }

  return new Response();
};
