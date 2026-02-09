import { data } from "react-router";
import { authenticate } from "../shopify.server";

const FILES_QUERY = `#graphql
  query getFiles($first: Int!, $after: String) {
    files(first: $first, after: $after) {
      edges {
        node {
          ... on MediaImage {
            id
            alt
            image {
              url
            }
          }
          ... on GenericFile {
            id
            alt
            url
          }
          ... on Video {
            id
            alt
            preview {
              image {
                url
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const after = url.searchParams.get("after") || null;
  const first = Math.min(Number(url.searchParams.get("first")) || 50, 100);

  const response = await admin.graphql(FILES_QUERY, {
    variables: { first, after },
  });
  const json = await response.json();

  if (json.errors) {
    return data(
      { files: [], pageInfo: { hasNextPage: false, endCursor: null }, error: json.errors[0]?.message },
      { status: 500 }
    );
  }

  const connection = json.data?.files ?? { edges: [], pageInfo: {} };
  const files = connection.edges.map(({ node }) => {
    const id = node.id;
    let label = id;
    let previewUrl = null;
    if (node.image) {
      previewUrl = node.image.url;
      label = node.alt || node.image.url?.split("/").pop() || id;
    } else if (node.url) {
      previewUrl = node.url;
      label = node.alt || node.url?.split("/").pop() || id;
    } else if (node.preview?.image?.url) {
      previewUrl = node.preview.image.url;
      label = node.alt || "Video";
    }
    return { id, label, previewUrl };
  });

  return data({
    files,
    pageInfo: connection.pageInfo || { hasNextPage: false, endCursor: null },
    error: null,
  });
};
