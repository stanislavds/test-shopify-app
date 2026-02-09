import { useEffect, useState } from "react";
import { useLoaderData, useSearchParams, useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  Page,
  Card,
  Button,
  Text,
  Pagination,
  Thumbnail,
  BlockStack,
  InlineStack,
  Modal,
  TextField,
  Box,
  Divider,
  Select,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") || null;
  const direction = url.searchParams.get("direction") || "next";
  const pageSize = 50;

  let query, variables;

  if (direction === "previous" && cursor) {
    query = `#graphql
      query getProducts($last: Int!, $before: String!) {
        products(last: $last, before: $before) {
          edges {
            node {
              id
              title
              handle
              status
              totalInventory
              createdAt
              featuredImage {
                url
                altText
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }`;
    variables = { last: pageSize, before: cursor };
  } else {
    query = `#graphql
      query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            node {
              id
              title
              handle
              status
              totalInventory
              createdAt
              featuredImage {
                url
                altText
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }`;
    variables = { first: pageSize, after: cursor || null };
  }

  const response = await admin.graphql(query, { variables });
  const responseJson = await response.json();
  const productsData = responseJson.data?.products || {
    edges: [],
    pageInfo: {},
  };
  let products = productsData.edges.map((edge) => edge.node);

  if (direction === "previous" && cursor) {
    products = products.reverse();
  }

  const pageInfo = productsData.pageInfo;
  return { products, pageInfo };
};

const METAFIELD_TYPE_OPTIONS = [
  { label: "Single line text", value: "single_line_text_field" },
  { label: "Multi-line text", value: "multi_line_text_field" },
  { label: "Integer", value: "number_integer" },
  { label: "Decimal", value: "number_decimal" },
  { label: "Boolean", value: "boolean" },
  { label: "Date", value: "date" },
  { label: "Date and time", value: "date_time" },
  { label: "JSON", value: "json" },
];

function metafieldsToForm(edges) {
  if (!edges?.length) return [];
  return edges.map(({ node }) => ({
    id: node.id,
    namespace: node.namespace ?? "",
    key: node.key ?? "",
    value: node.value ?? "",
    type: node.type ?? "single_line_text_field",
  }));
}

export default function Index() {
  const { products, pageInfo } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formMetafields, setFormMetafields] = useState([]);
  const fetcher = useFetcher();
  const metafieldsUrl =
    selectedProduct &&
    `/app/api/product/${encodeURIComponent(selectedProduct.id)}/metafields`;

  useEffect(() => {
    if (!selectedProduct || !metafieldsUrl) return;
    fetcher.load(metafieldsUrl);
  }, [selectedProduct?.id, metafieldsUrl]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.success === true && fetcher.data.metafields) {
      setFormMetafields(
        fetcher.data.metafields.map((m) => ({
          id: m.id,
          namespace: m.namespace ?? "",
          key: m.key ?? "",
          value: m.value ?? "",
          type: m.type ?? "single_line_text_field",
        }))
      );
    } else if (fetcher.data.product) {
      setFormMetafields(
        metafieldsToForm(fetcher.data.product.metafields?.edges ?? [])
      );
    } else {
      setFormMetafields([]);
    }
  }, [fetcher.state, fetcher.data]);

  const handleNextPage = () => {
    if (pageInfo.hasNextPage && pageInfo.endCursor) {
      const next = new URLSearchParams(searchParams);
      next.set("cursor", pageInfo.endCursor);
      next.set("direction", "next");
      setSearchParams(next);
    }
  };

  const handlePreviousPage = () => {
    if (!pageInfo.hasPreviousPage) return;
    const next = new URLSearchParams(searchParams);
    if (pageInfo.startCursor) {
      next.set("cursor", pageInfo.startCursor);
      next.set("direction", "previous");
    } else {
      next.delete("cursor");
      next.delete("direction");
    }
    setSearchParams(next);
  };

  const openEditModal = (product) => {
    setSelectedProduct({ id: product.id, title: product.title });
    setFormMetafields([]);
  };

  const closeModal = () => {
    setSelectedProduct(null);
    setFormMetafields([]);
  };

  const updateMetafield = (index, field, value) => {
    setFormMetafields((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addMetafield = () => {
    setFormMetafields((prev) => [
      ...prev,
      {
        namespace: "custom",
        key: "",
        value: "",
        type: "single_line_text_field",
      },
    ]);
  };

  const removeMetafield = (index) => {
    setFormMetafields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!selectedProduct || !metafieldsUrl) return;
    fetcher.submit(
      { metafields: formMetafields },
      { method: "POST", action: metafieldsUrl, encType: "application/json" }
    );
  };

  const isLoading =
    fetcher.state === "loading" && selectedProduct && !fetcher.data;
  const isSaving = fetcher.state === "submitting";
  const saveError =
    fetcher.data && fetcher.state === "idle" && !fetcher.data.success && fetcher.data.error;

  return (
    <Page title="Products">
      <BlockStack gap="500">
        {products.length === 0 ? (
          <Card>
            <Text as="p">No products found in your store.</Text>
          </Card>
        ) : (
          <BlockStack gap="400">
            {products.map((product) => (
              <Card key={product.id}>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      {product.title}
                    </Text>
                    <Button
                      variant="tertiary"
                      onClick={() => openEditModal(product)}
                    >
                      Edit
                    </Button>
                  </InlineStack>
                  <InlineStack gap="400" blockAlign="start">
                    {product.featuredImage && (
                      <Thumbnail
                        source={product.featuredImage.url}
                        alt={product.featuredImage.altText || product.title}
                        size="small"
                      />
                    )}
                    <BlockStack gap="200">
                      <Text as="p">
                        <strong>Status:</strong> {product.status}
                      </Text>
                      {product.priceRangeV2 && (
                        <Text as="p">
                          <strong>Price:</strong>{" "}
                          {product.priceRangeV2.minVariantPrice.amount}{" "}
                          {product.priceRangeV2.minVariantPrice.currencyCode}
                        </Text>
                      )}
                      <Text as="p">
                        <strong>Inventory:</strong> {product.totalInventory ?? 0}
                      </Text>
                      <Text as="p">
                        <strong>Handle:</strong> {product.handle}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </BlockStack>
              </Card>
            ))}
          </BlockStack>
        )}
        {(pageInfo.hasNextPage || pageInfo.hasPreviousPage) && (
          <Box paddingBlockStart="400">
            <Pagination
              hasPrevious={pageInfo.hasPreviousPage}
              onPrevious={handlePreviousPage}
              hasNext={pageInfo.hasNextPage}
              onNext={handleNextPage}
            />
          </Box>
        )}
      </BlockStack>

      {selectedProduct && (
        <Modal
          open
          onClose={closeModal}
          title={`Edit metafields — ${selectedProduct.title}`}
          primaryAction={{
            content: "Save",
            onAction: handleSave,
            loading: isSaving,
          }}
          secondaryActions={[{ content: "Cancel", onAction: closeModal }]}
          large
        >
          <Modal.Section>
            {isLoading ? (
              <Text as="p" tone="subdued">
                Loading metafields…
              </Text>
            ) : (
              <BlockStack gap="400">
                {saveError && (
                  <Box paddingBlockEnd="200">
                    <Text as="p" tone="critical">
                      {saveError}
                    </Text>
                  </Box>
                )}
                {formMetafields.length === 0 && !isLoading ? (
                  <Text as="p" tone="subdued">
                    No metafields yet. Add one below.
                  </Text>
                ) : (
                  formMetafields.map((m, index) => (
                    <Box key={m.id ?? index} paddingBlockEnd="400">
                      <BlockStack gap="200">
                        <InlineStack gap="200" blockAlign="end" wrap={false}>
                          <Box minWidth="120px">
                            <TextField
                              label="Namespace"
                              value={m.namespace}
                              onChange={(v) =>
                                updateMetafield(index, "namespace", v)
                              }
                              autoComplete="off"
                            />
                          </Box>
                          <Box minWidth="140px">
                            <TextField
                              label="Key"
                              value={m.key}
                              onChange={(v) =>
                                updateMetafield(index, "key", v)
                              }
                              autoComplete="off"
                            />
                          </Box>
                          <Box minWidth="200px">
                            <Select
                              label="Type"
                              options={METAFIELD_TYPE_OPTIONS}
                              value={m.type}
                              onChange={(v) =>
                                updateMetafield(index, "type", v)
                              }
                            />
                          </Box>
                          <Button
                            variant="plain"
                            tone="critical"
                            onClick={() => removeMetafield(index)}
                            accessibilityLabel="Remove metafield"
                          >
                            Remove
                          </Button>
                        </InlineStack>
                        <TextField
                          label="Value"
                          value={m.value}
                          onChange={(v) =>
                            updateMetafield(index, "value", v)
                          }
                          multiline={
                            m.type === "multi_line_text_field" ? 3 : 1
                          }
                          autoComplete="off"
                        />
                      </BlockStack>
                      {index < formMetafields.length - 1 && (
                        <Box paddingBlockStart="200">
                          <Divider />
                        </Box>
                      )}
                    </Box>
                  ))
                )}
                <Button onClick={addMetafield}>Add metafield</Button>
              </BlockStack>
            )}
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
