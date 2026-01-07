import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { AppProvider } from "@shopify/polaris";
import translations from "@shopify/polaris/locales/en.json";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  // Ensure shop record exists/updates automatically on each app access
  // This is a fallback in case afterAuth hook didn't run (e.g., existing sessions)
  if (session) {
    try {
      await prisma.shop.upsert({
        where: { shop: session.shop },
        update: {
          isActive: true,
          accessToken: session.accessToken,
          scope: session.scope || null,
          updatedAt: new Date(),
          uninstalledAt: null,
        },
        create: {
          shop: session.shop,
          domain: session.shop,
          accessToken: session.accessToken,
          scope: session.scope || null,
          isActive: true,
          installedAt: new Date(),
        },
      });
    } catch (error) {
      // Log but don't fail the request if shop record update fails
      console.error(`[app loader] Error updating shop record for ${session.shop}:`, error);
    }
  }

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <ShopifyAppProvider embedded apiKey={apiKey}>
      <AppProvider i18n={translations}>
        <s-app-nav>
          <s-link href="/app">Home</s-link>
          <s-link href="/app/additional">Additional page</s-link>
        </s-app-nav>
        <Outlet />
      </AppProvider>
    </ShopifyAppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
