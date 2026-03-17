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
// Most fields are optional — the generator derives them from the key + product dir.

const DetailUiAppSchema = z
    .object({
        type: z.literal('detail'),
        view_prop: z.string(),
        // All below are optional — derived by convention when omitted
        app_name: z.string().optional(),
        description: z.string().optional(),
        component_import: z.string().optional(),
        data_type: z.string().optional(),
        view_component: z.string().optional(),
    })
    .strict()

const ListUiAppSchema = z
    .object({
        type: z.literal('list'),
        detail_tool: z.string(),
        // Optional with sensible defaults
        detail_args: z.string().optional(),
        item_name_field: z.string().optional(),
        click_prop: z.string().optional(),
        entity_label: z.string().optional(),
        // All below are optional — derived by convention when omitted
        app_name: z.string().optional(),
        description: z.string().optional(),
        component_import: z.string().optional(),
        list_data_type: z.string().optional(),
        item_data_type: z.string().optional(),
        view_component: z.string().optional(),
    })
    .strict()

const CustomUiAppSchema = z
    .object({
        type: z.literal('custom'),
        app_name: z.string(),
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
