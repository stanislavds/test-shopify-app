import { data } from "react-router";
import { authenticate } from "../shopify.server";

const PRODUCT_METAFIELDS_QUERY = `#graphql
  query getProductMetafields($id: ID!) {
    product(id: $id) {
      id
      title
      metafields(first: 100) {
        edges {
          node {
            id
            namespace
            key
            value
            type
          }
        }
      }
    }
  }
`;

const METAFIELDS_SET_MUTATION = `#graphql
  mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
        type
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const productId = params.productId;
  if (!productId) {
    return data({ product: null, error: "Missing product ID" }, { status: 400 });
  }
  const response = await admin.graphql(PRODUCT_METAFIELDS_QUERY, {
    variables: { id: decodeURIComponent(productId) },
  });
  const json = await response.json();
  const product = json.data?.product ?? null;
  if (json.errors) {
    return data(
      {
        product: null,
        error: json.errors[0]?.message || "Failed to load metafields",
      },
      { status: 500 }
    );
  }
  return data({ product, error: null });
};

export const action = async ({ request, params }) => {
  if (request.method !== "POST") {
    return data({ success: false, error: "Method not allowed" }, { status: 405 });
  }
  const { admin } = await authenticate.admin(request);
  const productId = params.productId;
  if (!productId) {
    return data({ success: false, error: "Missing product ID" }, { status: 400 });
  }
  const ownerId = decodeURIComponent(productId);
  let body;
  try {
    body = await request.json();
  } catch {
    return data({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const { metafields } = body;
  if (!Array.isArray(metafields)) {
    return data(
      { success: false, error: "metafields must be an array" },
      { status: 400 }
    );
  }
  const input = metafields
    .filter((m) => m && (m.key?.trim() || m.value != null))
    .map((m) => ({
      ownerId,
      namespace: (m.namespace || "custom").trim() || "custom",
      key: (m.key || "").trim() || "key",
      value: String(m.value ?? ""),
      type: m.type || "single_line_text_field",
    }));
  if (input.length === 0) {
    return data({ success: true, metafields: [] });
  }
  const response = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: { metafields: input },
  });
  const json = await response.json();
  const payload = json.data?.metafieldsSet;
  if (json.errors) {
    return data(
      {
        success: false,
        error: json.errors[0]?.message || "Mutation failed",
      },
      { status: 500 }
    );
  }
  if (payload?.userErrors?.length > 0) {
    return data(
      {
        success: false,
        error: payload.userErrors.map((e) => e.message).join("; "),
      },
      { status: 422 }
    );
  }
  return data({ success: true, metafields: payload?.metafields ?? [] });
};
