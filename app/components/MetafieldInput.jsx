import { useState, useCallback } from "react";
import { useFetcher } from "react-router";
import {
  TextField,
  Checkbox,
  Select,
  Button,
  Box,
  InlineStack,
  Text,
  Thumbnail,
  BlockStack,
  Popover,
  Icon,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";

function parseListValue(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getChoicesFromValidations(validations) {
  if (!Array.isArray(validations)) return null;
  const choiceValidation = validations.find(
    (v) => v?.name?.toLowerCase() === "choices"
  );
  if (!choiceValidation?.value) return null;
  try {
    const parsed = JSON.parse(choiceValidation.value);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed).map(([value, label]) => ({
        value: String(value),
        label: String(label ?? value),
      }));
    }
    return null;
  } catch {
    return null;
  }
}

export function MetafieldInput({
  label,
  type,
  value,
  onChange,
  validations = [],
  disabled,
}) {
  const t = String(type || "single_line_text_field").toLowerCase();
  const choices = getChoicesFromValidations(validations);

  if (t === "boolean") {
    const checked = value === "true" || value === true || value === "1";
    return (
      <Box paddingBlockEnd="200">
        <Checkbox
          label={label}
          checked={checked}
          onChange={(v) => onChange(v ? "true" : "false")}
          disabled={disabled}
        />
      </Box>
    );
  }

  if (t === "number_integer" || t === "number_decimal") {
    return (
      <TextField
        label={label}
        type="number"
        value={value == null ? "" : String(value)}
        onChange={onChange}
        disabled={disabled}
        autoComplete="off"
      />
    );
  }

  if (t === "date") {
    return (
      <TextField
        label={label}
        type="date"
        value={value == null ? "" : String(value).slice(0, 10)}
        onChange={onChange}
        disabled={disabled}
        autoComplete="off"
      />
    );
  }

  if (t === "date_time") {
    let display = value == null ? "" : String(value);
    if (display && !display.includes("T")) {
      display = display.slice(0, 10) + "T00:00:00";
    }
    return (
      <TextField
        label={label}
        type="datetime-local"
        value={display.slice(0, 19)}
        onChange={onChange}
        disabled={disabled}
        autoComplete="off"
      />
    );
  }

  if (t === "color") {
    const hex = String(value ?? "").trim();
    const match = hex.match(/^#([0-9A-Fa-f]{6})$/);
    const colorValue = match ? hex : "#000000";
    return (
      <BlockStack gap="200">
        <Text as="span" variant="bodyMd" fontWeight="medium">
          {label}
        </Text>
        <InlineStack gap="300" blockAlign="center">
          <input
            type="color"
            value={colorValue}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            style={{
              width: 40,
              height: 32,
              border: "1px solid var(--p-color-border)",
              borderRadius: "var(--p-border-radius-200)",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          />
          <Box minWidth="120px">
            <TextField
              label=""
              labelHidden
              value={hex}
              onChange={onChange}
              disabled={disabled}
              placeholder="#000000"
              autoComplete="off"
            />
          </Box>
        </InlineStack>
      </BlockStack>
    );
  }

  if (t === "single_line_text_field" && choices?.length > 0) {
    const options = choices.map((c) =>
      typeof c === "string"
        ? { value: c, label: c }
        : { value: c.value ?? c.label, label: c.label ?? c.value }
    );
    return (
      <Select
        label={label}
        options={[{ value: "", label: " " }, ...options]}
        value={value == null ? "" : String(value)}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (t === "multi_line_text_field") {
    return (
      <TextField
        label={label}
        value={value == null ? "" : String(value)}
        onChange={onChange}
        multiline={3}
        disabled={disabled}
        autoComplete="off"
      />
    );
  }

  if (t === "json" || t.includes("json")) {
    return (
      <TextField
        label={label}
        value={value == null ? "" : String(value)}
        onChange={onChange}
        multiline={3}
        helpText='Must be valid JSON, e.g. {"key": "value"}'
        disabled={disabled}
        autoComplete="off"
      />
    );
  }

  if (t.startsWith("list.")) {
    return (
      <ListMetafieldInput
        label={label}
        type={t}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (t === "file_reference") {
    return (
      <FileReferenceInput
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
        showClear
      />
    );
  }

  if (t === "list.file_reference") {
    return (
      <ListFileReferenceInput
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (
    t === "product_reference" ||
    t === "collection_reference" ||
    t === "variant_reference"
  ) {
    return (
      <ReferencePickerInput
        label={label}
        type={t}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  return (
    <TextField
      label={label}
      value={value == null ? "" : String(value)}
      onChange={onChange}
      disabled={disabled}
      autoComplete="off"
    />
  );
}

function ListMetafieldInput({ label, type, value, onChange, disabled }) {
  const itemType = type.replace(/^list\./, "") || "single_line_text_field";
  const items = parseListValue(value);

  const updateItems = useCallback(
    (next) => {
      onChange(JSON.stringify(next));
    },
    [onChange]
  );

  const addItem = useCallback(() => {
    updateItems([...items, ""]);
  }, [items, updateItems]);

  const setItem = useCallback(
    (index, val) => {
      const next = [...items];
      next[index] = val;
      updateItems(next);
    },
    [items, updateItems]
  );

  const removeItem = useCallback(
    (index) => {
      const next = items.filter((_, i) => i !== index);
      updateItems(next);
    },
    [items, updateItems]
  );

  return (
    <BlockStack gap="300">
      <Text as="span" variant="bodyMd" fontWeight="medium">
        {label}
      </Text>
      <BlockStack gap="200">
        {items.map((item, index) => (
          <InlineStack key={index} gap="200" blockAlign="center" wrap={false}>
            <Box minWidth="0" flex={1}>
              <TextField
                label=""
                labelHidden
                value={item}
                onChange={(v) => setItem(index, v)}
                disabled={disabled}
                autoComplete="off"
                multiline={itemType === "multi_line_text_field" ? 2 : 1}
              />
            </Box>
            <Button
              variant="plain"
              tone="critical"
              onClick={() => removeItem(index)}
              disabled={disabled}
              accessibilityLabel="Remove item"
            >
              Remove
            </Button>
          </InlineStack>
        ))}
        <Button onClick={addItem} disabled={disabled}>
          Add item
        </Button>
      </BlockStack>
    </BlockStack>
  );
}

function FileReferenceInput({ label, value, onChange, disabled, showClear = true }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const fetcher = useFetcher();
  const files = fetcher.data?.files ?? [];
  const loading = fetcher.state === "loading";

  const openPicker = useCallback(() => {
    setPickerOpen(true);
    if (fetcher.state === "idle" && !fetcher.data) {
      fetcher.load("/app/api/files");
    }
  }, [fetcher]);

  const currentId = value == null ? "" : String(value).trim();
  const currentFile = files.find((f) => f.id === currentId);

  return (
    <BlockStack gap="200">
      {label ? (
        <Text as="span" variant="bodyMd" fontWeight="medium">
          {label}
        </Text>
      ) : null}
      <InlineStack gap="300" blockAlign="center">
        {currentFile?.previewUrl ? (
          <Thumbnail source={currentFile.previewUrl} alt={currentFile.label} size="small" />
        ) : (
          <Box
            background="bg-surface-secondary"
            padding="200"
            borderRadius="200"
            minWidth="40px"
            minHeight="40px"
          >
            <Icon source={ImageIcon} tone="subdued" />
          </Box>
        )}
        <BlockStack gap="100">
          {currentId ? (
            <Text as="p" variant="bodySm" tone="subdued">
              {currentFile?.label ?? currentId}
            </Text>
          ) : null}
          <InlineStack gap="200">
            <Popover
              active={pickerOpen}
              autofocusTarget="first-node"
              onClose={() => setPickerOpen(false)}
              preferredAlignment="left"
              activator={
                <Button onClick={openPicker} disabled={disabled}>
                  Choose file
                </Button>
              }
            >
              <Popover.Pane fixed>
                <Box padding="300" minWidth="320px" maxHeight="60vh" overflowY="auto">
                  {loading ? (
                    <Text as="p" tone="subdued">
                      Loading files…
                    </Text>
                  ) : files.length === 0 ? (
                    <Text as="p" tone="subdued">
                      No files in your store. Upload files in Settings → Files.
                    </Text>
                  ) : (
                    <BlockStack gap="100">
                      {files.map((file) => (
                        <Box
                          key={file.id}
                          padding="200"
                          background="bg-surface-hover"
                          borderRadius="200"
                          cursor="pointer"
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            onChange(file.id);
                            setPickerOpen(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onChange(file.id);
                              setPickerOpen(false);
                            }
                          }}
                        >
                          <InlineStack gap="200" blockAlign="center">
                            {file.previewUrl ? (
                              <Thumbnail
                                source={file.previewUrl}
                                alt={file.label}
                                size="small"
                              />
                            ) : null}
                            <Text as="span">{file.label}</Text>
                          </InlineStack>
                        </Box>
                      ))}
                    </BlockStack>
                  )}
                </Box>
              </Popover.Pane>
            </Popover>
            {showClear && currentId ? (
              <Button
                variant="plain"
                tone="critical"
                onClick={() => onChange("")}
                disabled={disabled}
              >
                Clear
              </Button>
            ) : null}
          </InlineStack>
        </BlockStack>
      </InlineStack>
    </BlockStack>
  );
}

function ListFileReferenceInput({ label, value, onChange, disabled }) {
  const items = parseListValue(value);
  const listValue = items.map((v) => (typeof v === "string" ? v : v?.id ?? ""));

  const updateList = useCallback(
    (next) => {
      onChange(JSON.stringify(next));
    },
    [onChange]
  );

  const addItem = useCallback(() => {
    updateList([...listValue, ""]);
  }, [listValue, updateList]);

  const setItem = useCallback(
    (index, val) => {
      const next = [...listValue];
      next[index] = val;
      updateList(next);
    },
    [listValue, updateList]
  );

  const removeItem = useCallback(
    (index) => {
      updateList(listValue.filter((_, i) => i !== index));
    },
    [listValue, updateList]
  );

  return (
    <BlockStack gap="300">
      <Text as="span" variant="bodyMd" fontWeight="medium">
        {label}
      </Text>
      <BlockStack gap="200">
        {listValue.map((gid, index) => (
          <InlineStack key={index} gap="200" blockAlign="center" wrap={false}>
            <Box minWidth="0" flex={1}>
              <FileReferenceInput
                label=""
                value={gid}
                onChange={(v) => setItem(index, v)}
                disabled={disabled}
                showClear={false}
              />
            </Box>
            <Button
              variant="plain"
              tone="critical"
              onClick={() => removeItem(index)}
              disabled={disabled}
              accessibilityLabel="Remove file"
            >
              Remove
            </Button>
          </InlineStack>
        ))}
        <Button onClick={addItem} disabled={disabled}>
          Add file
        </Button>
      </BlockStack>
    </BlockStack>
  );
}

function ReferencePickerInput({ label, type, value, onChange, disabled }) {
  const shopify = useAppBridge();
  const [loading, setLoading] = useState(false);

  const resourceType =
    type === "product_reference"
      ? "product"
      : type === "collection_reference"
        ? "collection"
        : "variant";

  const openPicker = useCallback(async () => {
    if (disabled) return;
    setLoading(true);
    try {
      const result = await shopify.resourcePicker({
        type: resourceType,
        action: "select",
        multiple: false,
      });
      const selection = result?.selection ?? (Array.isArray(result) ? result : []);
      const first = Array.isArray(selection) ? selection[0] : selection;
      if (first?.id) {
        onChange(first.id);
      }
    } catch (err) {
      console.error("Resource picker error:", err);
    } finally {
      setLoading(false);
    }
  }, [disabled, resourceType, onChange, shopify]);

  return (
    <BlockStack gap="200">
      <Text as="span" variant="bodyMd" fontWeight="medium">
        {label}
      </Text>
      <InlineStack gap="200">
        <Button onClick={openPicker} disabled={disabled} loading={loading}>
          Select {resourceType}
        </Button>
        {value ? (
          <>
            <Text as="span" variant="bodySm" tone="subdued">
              {String(value)}
            </Text>
            <Button
              variant="plain"
              tone="critical"
              onClick={() => onChange("")}
              disabled={disabled}
            >
              Clear
            </Button>
          </>
        ) : null}
      </InlineStack>
    </BlockStack>
  );
}
