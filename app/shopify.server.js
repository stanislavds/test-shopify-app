import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
  afterAuth: async ({ session }) => {
    // Create or update shop record when app is installed or re-authenticated
    try {
      console.log(`[afterAuth] Processing shop: ${session.shop}`);
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
      console.log(`[afterAuth] Successfully created/updated shop record for ${session.shop}`);
    } catch (error) {
      console.error(`[afterAuth] Error creating shop record for ${session.shop}:`, error);
      // Don't throw - allow auth to complete even if shop record creation fails
      // The check-db script will create it automatically
    }
  },
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
