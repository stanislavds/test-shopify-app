import { useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
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
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") || null;
  const direction = url.searchParams.get("direction") || "next";
  const pageSize = 50;

  let query, variables;

  if (direction === "previous" && cursor) {
    // Use last with before for backward pagination
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
    variables = {
      last: pageSize,
      before: cursor,
    };
  } else {
    // Use first with after for forward pagination or initial load
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
    variables = {
      first: pageSize,
      after: cursor || null,
    };
  }

  const response = await admin.graphql(query, { variables });
  const responseJson = await response.json();
  const productsData = responseJson.data?.products || { edges: [], pageInfo: {} };
  let products = productsData.edges.map((edge) => edge.node);
  
  // When using 'before' with 'last', results come in reverse order, so reverse them
  if (direction === "previous" && cursor) {
    products = products.reverse();
  }
  
  const pageInfo = productsData.pageInfo;

  return { products, pageInfo };
};


export default function Index() {
  const shopify = useAppBridge();
  const { products, pageInfo } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleNextPage = () => {
    if (pageInfo.hasNextPage && pageInfo.endCursor) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("cursor", pageInfo.endCursor);
      newParams.set("direction", "next");
      setSearchParams(newParams);
    }
  };

  const handlePreviousPage = () => {
    if (pageInfo.hasPreviousPage) {
      const newParams = new URLSearchParams(searchParams);
      if (pageInfo.startCursor) {
        newParams.set("cursor", pageInfo.startCursor);
        newParams.set("direction", "previous");
      } else {
        // Go back to first page
        newParams.delete("cursor");
        newParams.delete("direction");
      }
      setSearchParams(newParams);
    }
  };

  const hasNext = pageInfo.hasNextPage;
  const hasPrevious = pageInfo.hasPreviousPage;

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
                    <Text as="h2" variant="headingMd">{product.title}</Text>
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        shopify.intents.invoke?.("edit:shopify/Product", {
                          value: product.id,
                        });
                      }}
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
                        <strong>Inventory:</strong> {product.totalInventory || 0}
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
        {(hasNext || hasPrevious) && (
          <div style={{ marginTop: "2rem" }}>
            <Pagination
              hasPrevious={hasPrevious}
              onPrevious={handlePreviousPage}
              hasNext={hasNext}
              onNext={handleNextPage}
            />
          </div>
        )}
      </BlockStack>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
