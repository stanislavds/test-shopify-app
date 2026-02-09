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
    if (fetcher.data.success === true && metafieldsUrl) {
      fetcher.load(metafieldsUrl);
      return;
    }
    if (fetcher.data.metafields && fetcher.data.success !== true) {
      const list = Array.isArray(fetcher.data.metafields)
        ? fetcher.data.metafields
        : [];
      setFormMetafields(
        list.map((m) => ({
          id: m.id,
          name: m.name ?? `${m.namespace ?? ""}.${m.key ?? ""}`,
          namespace: m.namespace ?? "",
          key: m.key ?? "",
          value: m.value ?? "",
          type: m.type ?? "single_line_text_field",
        }))
      );
    } else if (fetcher.data.product === null && !fetcher.data.success) {
      setFormMetafields([]);
    }
  }, [fetcher.state, fetcher.data, metafieldsUrl]);

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

  const updateMetafieldValue = (index, value) => {
    setFormMetafields((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], value };
      return next;
    });
  };

  const handleSave = () => {
    if (!selectedProduct || !metafieldsUrl) return;
    fetcher.submit(
      { metafields: formMetafields },
      {
        method: "POST",
        action: metafieldsUrl,
        encType: "application/json",
      }
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
                    No metafields defined for products. Add definitions in Settings → Custom data.
                  </Text>
                ) : (
                  formMetafields.map((m, index) => (
                    <Box
                      key={m.id ?? `${m.namespace}.${m.key}` ?? index}
                      paddingBlockEnd="300"
                    >
                      <TextField
                        label={m.name}
                        value={m.value}
                        onChange={(v) => updateMetafieldValue(index, v)}
                        multiline={
                          m.type === "multi_line_text_field" ? 3 : 1
                        }
                        helpText={
                          m.type === "json" || String(m.type).toLowerCase().includes("json")
                            ? 'Must be valid JSON, e.g. {"key": "value"}'
                            : undefined
                        }
                        autoComplete="off"
                      />
                    </Box>
                  ))
                )}
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
