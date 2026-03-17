/**
 * Zod schemas for MCP YAML tool definitions.
 *
 * Shared between generate-tools.ts and scaffold-yaml.ts to validate
 * that product-authored YAML configs are well-formed. Uses .strict()
 * on all objects to reject unknown keys (catches typos).
 */
import { z } from 'zod'

export const ToolConfigSchema = z
    .object({
        operation: z.string(),
        enabled: z.boolean(),
        scopes: z.array(z.string()).optional(),
        annotations: z
            .object({
                readOnly: z.boolean(),
                destructive: z.boolean(),
                idempotent: z.boolean(),
            })
            .strict()
            .optional(),
        input_schema: z.string().optional(),
        enrich_url: z.string().optional(),
        list: z.boolean().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        exclude_params: z.array(z.string()).optional(),
        include_params: z.array(z.string()).optional(),
        param_overrides: z
            .record(
                z.string(),
                z
                    .object({
                        description: z.string().optional(),
                        input_schema: z.string().optional(),
                    })
                    .strict()
            )
            .optional(),
        mcp_version: z.number().int().positive().optional(),
        /** References a key in ui_apps. */
        ui_app: z.string().optional(),
        /**
         * When true, the tool issues PATCH { deleted: true } instead of DELETE.
         * Use for endpoints backed by ForbidDestroyModel where soft-delete is the
         * correct operation.
         */
        soft_delete: z.boolean().optional(),
    })
    .strict()
    .refine(
        (data) =>
            !data.input_schema ||
            (!data.include_params?.length && !data.exclude_params?.length && !data.param_overrides),
        {
            message:
                'input_schema replaces the entire schema, so include_params, exclude_params, and param_overrides have no effect and should be removed',
        }
    )

export type ToolConfig = z.infer<typeof ToolConfigSchema>

/** Narrowed type for enabled tools — scopes and annotations are guaranteed present. */
export type EnabledToolConfig = Omit<ToolConfig, 'scopes' | 'annotations'> & {
    scopes: string[]
    annotations: { readOnly: boolean; destructive: boolean; idempotent: boolean }
}

// --- UI App schemas ---
//
// Each entry under ui_apps in a tools.yaml file defines a UI app.
// The discriminator is `type`: 'detail', 'list', or 'custom'.
//
// Most fields are optional — the generator (generate-ui-apps.ts) derives
// them from the app key + the product directory the YAML lives in.
// See resolveDetailApp() and resolveListApp() in generate-ui-apps.ts
// for the full derivation logic.
//
// To add a new field:
// 1. Add it to the appropriate schema below (with .optional() if it has a default)
// 2. Add it to the matching Resolved* interface
// 3. Add the default derivation in the resolve*App() function in generate-ui-apps.ts
// 4. Use the resolved value in generateDetailApp() or generateListApp()

/**
 * Detail UI app — renders a single entity.
 *
 * Generated entry point wraps the view component in AppWrapper and mounts it.
 * The only required field is `view_prop` — everything else is derived by convention.
 */
const DetailUiAppSchema = z
    .object({
        /** Discriminator. Must be 'detail'. */
        type: z.literal('detail'),
        /** The prop name passed to the view component. Required — cannot be derived. */
        view_prop: z.string(),
        /** Display name shown in the MCP client. Default: "PostHog " + title-case of key. */
        app_name: z.string().optional(),
        /** Short description for the MCP resource. Default: title-case of key + " detail view". */
        description: z.string().optional(),
        /** Import path for the view component. Default: derived from product dir (products/{product}/mcp/apps). */
        component_import: z.string().optional(),
        /** TypeScript type for the tool result data. Default: PascalCase(key) + "Data". */
        data_type: z.string().optional(),
        /** React component name that renders the detail view. Default: PascalCase(key) + "View". */
        view_component: z.string().optional(),
    })
    .strict()

/**
 * List UI app — renders a list with drill-down into detail via a tool call.
 *
 * Generated entry point includes the list component, a fallback-to-chat function,
 * and a click handler that calls `detail_tool` via app.callServerTool().
 * The only required field is `detail_tool` — everything else has a default.
 */
const ListUiAppSchema = z
    .object({
        /** Discriminator. Must be 'list'. */
        type: z.literal('list'),
        /** Tool name to call when a list item is clicked (e.g. 'action-get'). Required. */
        detail_tool: z.string(),
        /** JS expression for arguments passed to the detail tool. Default: '{ id: item.id }'. */
        detail_args: z.string().optional(),
        /** Field on the item object used for display in loading/fallback states. Default: 'name'. */
        item_name_field: z.string().optional(),
        /** Prop name for the click handler on the list component. Default: 'on' + PascalCase(singularKey) + 'Click'. */
        click_prop: z.string().optional(),
        /** Human-readable entity label for the fallback chat message. Default: kebab-to-space of singular key. */
        entity_label: z.string().optional(),
        /** Display name shown in the MCP client. Default: "PostHog " + title-case of key. */
        app_name: z.string().optional(),
        /** Short description for the MCP resource. Default: title-case of key + " view". */
        description: z.string().optional(),
        /** Import path for the view component. Default: derived from product dir (products/{product}/mcp/apps). */
        component_import: z.string().optional(),
        /** TypeScript type for the full list response. Default: PascalCase(singularKey) + "ListData". */
        list_data_type: z.string().optional(),
        /** TypeScript type for a single item. Default: PascalCase(singularKey) + "Data". */
        item_data_type: z.string().optional(),
        /** React component name that renders the list view. Default: PascalCase(key) + "View". */
        view_component: z.string().optional(),
    })
    .strict()

/**
 * Custom UI app — handwritten entry point, only gets a registry entry.
 *
 * Use for apps that need fully custom logic (e.g. debug.tsx, query-results.tsx).
 * The generator does NOT create an entry point file — you maintain it manually at
 * services/mcp/src/ui-apps/apps/{key}.tsx.
 */
const CustomUiAppSchema = z
    .object({
        /** Discriminator. Must be 'custom'. */
        type: z.literal('custom'),
        /** Display name shown in the MCP client. Required for custom apps (no convention to derive from). */
        app_name: z.string(),
        /** Short description for the MCP resource. Required for custom apps. */
        description: z.string(),
    })
    .strict()

export const UiAppConfigSchema = z.discriminatedUnion('type', [DetailUiAppSchema, ListUiAppSchema, CustomUiAppSchema])

export type UiAppConfig = z.infer<typeof UiAppConfigSchema>

/** Detail config with all fields resolved (after convention defaults are applied). */
export interface ResolvedDetailUiApp {
    type: 'detail'
    view_prop: string
    app_name: string
    description: string
    component_import: string
    data_type: string
    view_component: string
}

/** List config with all fields resolved (after convention defaults are applied). */
export interface ResolvedListUiApp {
    type: 'list'
    detail_tool: string
    detail_args: string
    item_name_field: string
    click_prop: string
    entity_label: string
    app_name: string
    description: string
    component_import: string
    list_data_type: string
    item_data_type: string
    view_component: string
}

export const CategoryConfigSchema = z
    .object({
        category: z.string(),
        feature: z.string(),
        url_prefix: z.string(),
        tools: z.record(z.string(), ToolConfigSchema),
        ui_apps: z.record(z.string(), UiAppConfigSchema).optional(),
    })
    .strict()

export type CategoryConfig = z.infer<typeof CategoryConfigSchema>
