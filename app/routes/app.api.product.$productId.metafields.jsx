import { data } from "react-router";
import { authenticate } from "../shopify.server";

const DEFINITIONS_QUERY = `#graphql
  query getProductMetafieldDefinitions($ownerType: MetafieldOwnerType!, $first: Int!) {
    metafieldDefinitions(ownerType: $ownerType, first: $first) {
      nodes {
        id
        name
        namespace
        key
        type {
          name
        }
      }
    }
  }
`;

const PRODUCT_METAFIELDS_QUERY = `#graphql
  query getProductMetafields($id: ID!) {
    product(id: $id) {
      id
      title
      metafields(first: 250) {
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
    return data({ product: null, metafields: [], error: "Missing product ID" }, { status: 400 });
  }
  const id = decodeURIComponent(productId);

  const [defRes, productRes] = await Promise.all([
    admin.graphql(DEFINITIONS_QUERY, {
      variables: { ownerType: "PRODUCT", first: 250 },
    }),
    admin.graphql(PRODUCT_METAFIELDS_QUERY, { variables: { id } }),
  ]);

  const defJson = await defRes.json();
  const productJson = await productRes.json();

  if (defJson.errors || productJson.errors) {
    return data(
      {
        product: null,
        metafields: [],
        error: defJson.errors?.[0]?.message || productJson.errors?.[0]?.message || "Failed to load",
      },
      { status: 500 }
    );
  }

  const product = productJson.data?.product ?? null;
  const definitions = defJson.data?.metafieldDefinitions?.nodes ?? [];
  const productMetafields = product?.metafields?.edges ?? [];
  const valueByKey = new Map();
  const idByKey = new Map();
  const typeByKey = new Map();
  for (const { node } of productMetafields) {
    const k = `${node.namespace}.${node.key}`;
    valueByKey.set(k, node.value ?? "");
    idByKey.set(k, node.id);
    typeByKey.set(k, node.type ?? "single_line_text_field");
  }

  let metafields;
  if (definitions.length > 0) {
    metafields = definitions.map((def) => {
      const k = `${def.namespace}.${def.key}`;
      const typeName = def.type?.name ?? "single_line_text_field";
      return {
        id: idByKey.get(k) ?? null,
        name: def.name || `${def.namespace}.${def.key}`,
        namespace: def.namespace,
        key: def.key,
        value: valueByKey.has(k) ? valueByKey.get(k) : "",
        type: typeName,
      };
    });
  } else {
    metafields = productMetafields.map(({ node }) => ({
      id: node.id,
      name: `${node.namespace}.${node.key}`,
      namespace: node.namespace ?? "",
      key: node.key ?? "",
      value: node.value ?? "",
      type: node.type ?? "single_line_text_field",
    }));
  }

  return data({
    product: product ? { id: product.id, title: product.title } : null,
    metafields,
    error: null,
  });
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
