
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "addresses": {
                  Row: {
                    "address_line": string,"city": string,"created_at": string,"id": string,"is_default": boolean,"label": string | null,"notes": string | null,"profile_id": string,"updated_at": string
                  }
                  Insert: {
                    "address_line": string,"city": string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"label"?: string | null,"notes"?: string | null,"profile_id": string,"updated_at"?: string
                  }
                  Update: {
                    "address_line"?: string,"city"?: string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"label"?: string | null,"notes"?: string | null,"profile_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "addresses_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"availability_items": {
                  Row: {
                    "available_quantity": number,"created_at": string,"cycle_id": string,"id": string,"listed": boolean,"maximum_quantity": number | null,"minimum_quantity": number | null,"ordered_quantity": number,"price": number,"product_id": string,"sort_order": number,"tenant_id": string,"updated_at": string
                  }
                  Insert: {
                    "available_quantity": number,"created_at"?: string,"cycle_id": string,"id"?: string,"listed"?: boolean,"maximum_quantity"?: number | null,"minimum_quantity"?: number | null,"ordered_quantity"?: number,"price": number,"product_id": string,"sort_order"?: number,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "available_quantity"?: number,"created_at"?: string,"cycle_id"?: string,"id"?: string,"listed"?: boolean,"maximum_quantity"?: number | null,"minimum_quantity"?: number | null,"ordered_quantity"?: number,"price"?: number,"product_id"?: string,"sort_order"?: number,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_items_tenant_id_cycle_id_fkey"
      columns: ["tenant_id","cycle_id"]
isOneToOne: false
      referencedRelation: "weekly_cycles"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "availability_items_tenant_id_product_id_fkey"
      columns: ["tenant_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "active": boolean,"created_at": string,"farmer_notes": string | null,"id": string,"profile_id": string,"tenant_id": string,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"farmer_notes"?: string | null,"id"?: string,"profile_id": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"farmer_notes"?: string | null,"id"?: string,"profile_id"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customers_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "attempts": number,"channel": string,"created_at": string,"event": string,"id": string,"last_error": string | null,"locale": string,"next_attempt_at": string,"payload": NonNullable<Json>,"recipient": string,"sent_at": string | null,"status": Database["public"]['Enums']["notification_status"],"tenant_id": string
                  }
                  Insert: {
                    "attempts"?: number,"channel"?: string,"created_at"?: string,"event": string,"id"?: string,"last_error"?: string | null,"locale"?: string,"next_attempt_at"?: string,"payload"?: NonNullable<Json>,"recipient": string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"],"tenant_id": string
                  }
                  Update: {
                    "attempts"?: number,"channel"?: string,"created_at"?: string,"event"?: string,"id"?: string,"last_error"?: string | null,"locale"?: string,"next_attempt_at"?: string,"payload"?: NonNullable<Json>,"recipient"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"],"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "availability_item_id": string,"id": string,"order_id": string,"product_id": string,"product_name_snapshot": string,"quantity": number,"tenant_id": string,"total_price": number,"unit_price": number,"unit_snapshot": string
                  }
                  Insert: {
                    "availability_item_id": string,"id"?: string,"order_id": string,"product_id": string,"product_name_snapshot": string,"quantity": number,"tenant_id": string,"total_price": number,"unit_price": number,"unit_snapshot": string
                  }
                  Update: {
                    "availability_item_id"?: string,"id"?: string,"order_id"?: string,"product_id"?: string,"product_name_snapshot"?: string,"quantity"?: number,"tenant_id"?: string,"total_price"?: number,"unit_price"?: number,"unit_snapshot"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_tenant_id_availability_item_id_fkey"
      columns: ["tenant_id","availability_item_id"]
isOneToOne: false
      referencedRelation: "availability_items"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "order_items_tenant_id_order_id_fkey"
      columns: ["tenant_id","order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "order_items_tenant_id_product_id_fkey"
      columns: ["tenant_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"order_status_history": {
                  Row: {
                    "changed_by": string | null,"created_at": string,"from_status": Database["public"]['Enums']["order_status"] | null,"id": string,"note": string | null,"order_id": string,"tenant_id": string,"to_status": Database["public"]['Enums']["order_status"]
                  }
                  Insert: {
                    "changed_by"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: string,"note"?: string | null,"order_id": string,"tenant_id": string,"to_status": Database["public"]['Enums']["order_status"]
                  }
                  Update: {
                    "changed_by"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: string,"note"?: string | null,"order_id"?: string,"tenant_id"?: string,"to_status"?: Database["public"]['Enums']["order_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_status_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_status_history_tenant_id_order_id_fkey"
      columns: ["tenant_id","order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "created_at": string,"currency": string,"customer_email": string,"customer_id": string,"customer_name": string,"customer_phone": string,"cycle_id": string,"delivery_address": string | null,"delivery_city": string | null,"delivery_fee": number,"delivery_method": Database["public"]['Enums']["delivery_method"],"delivery_notes": string | null,"id": string,"idempotency_key": string,"notes": string | null,"order_number": number,"placed_at": string,"status": Database["public"]['Enums']["order_status"],"status_changed_at": string,"subtotal": number,"tenant_id": string,"total": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"currency": string,"customer_email": string,"customer_id": string,"customer_name": string,"customer_phone": string,"cycle_id": string,"delivery_address"?: string | null,"delivery_city"?: string | null,"delivery_fee": number,"delivery_method": Database["public"]['Enums']["delivery_method"],"delivery_notes"?: string | null,"id"?: string,"idempotency_key": string,"notes"?: string | null,"order_number": number,"placed_at"?: string,"status"?: Database["public"]['Enums']["order_status"],"status_changed_at"?: string,"subtotal": number,"tenant_id": string,"total": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"customer_email"?: string,"customer_id"?: string,"customer_name"?: string,"customer_phone"?: string,"cycle_id"?: string,"delivery_address"?: string | null,"delivery_city"?: string | null,"delivery_fee"?: number,"delivery_method"?: Database["public"]['Enums']["delivery_method"],"delivery_notes"?: string | null,"id"?: string,"idempotency_key"?: string,"notes"?: string | null,"order_number"?: number,"placed_at"?: string,"status"?: Database["public"]['Enums']["order_status"],"status_changed_at"?: string,"subtotal"?: number,"tenant_id"?: string,"total"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_tenant_id_customer_id_fkey"
      columns: ["tenant_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "orders_tenant_id_cycle_id_fkey"
      columns: ["tenant_id","cycle_id"]
isOneToOne: false
      referencedRelation: "weekly_cycles"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"products": {
                  Row: {
                    "active": boolean,"category": string | null,"created_at": string,"description": string | null,"id": string,"image_path": string | null,"name": string,"quantity_step": number,"sort_order": number,"tenant_id": string,"unit_code": string,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"category"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"image_path"?: string | null,"name": string,"quantity_step": number,"sort_order"?: number,"tenant_id": string,"unit_code": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"category"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"image_path"?: string | null,"name"?: string,"quantity_step"?: number,"sort_order"?: number,"tenant_id"?: string,"unit_code"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_unit_code_fkey"
      columns: ["unit_code"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["code"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"deletion_requested_at": string | null,"email": string,"first_name": string,"id": string,"last_name": string,"phone": string | null,"preferred_locale": string,"privacy_accepted_at": string | null,"role": Database["public"]['Enums']["app_role"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"deletion_requested_at"?: string | null,"email": string,"first_name": string,"id": string,"last_name"?: string,"phone"?: string | null,"preferred_locale"?: string,"privacy_accepted_at"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deletion_requested_at"?: string | null,"email"?: string,"first_name"?: string,"id"?: string,"last_name"?: string,"phone"?: string | null,"preferred_locale"?: string,"privacy_accepted_at"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tenant_members": {
                  Row: {
                    "created_at": string,"profile_id": string,"tenant_id": string
                  }
                  Insert: {
                    "created_at"?: string,"profile_id": string,"tenant_id": string
                  }
                  Update: {
                    "created_at"?: string,"profile_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_members_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tenant_members_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenants": {
                  Row: {
                    "active": boolean,"address": string | null,"created_at": string,"currency": string,"delivery_enabled": boolean,"delivery_fee": number,"delivery_information": string | null,"description": string | null,"email": string | null,"enforce_inventory": boolean,"id": string,"logo_path": string | null,"name": string,"next_order_number": number,"phone": string | null,"pickup_enabled": boolean,"pickup_information": string | null,"slug": string,"timezone": string,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"address"?: string | null,"created_at"?: string,"currency"?: string,"delivery_enabled"?: boolean,"delivery_fee"?: number,"delivery_information"?: string | null,"description"?: string | null,"email"?: string | null,"enforce_inventory"?: boolean,"id"?: string,"logo_path"?: string | null,"name": string,"next_order_number"?: number,"phone"?: string | null,"pickup_enabled"?: boolean,"pickup_information"?: string | null,"slug": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"address"?: string | null,"created_at"?: string,"currency"?: string,"delivery_enabled"?: boolean,"delivery_fee"?: number,"delivery_information"?: string | null,"description"?: string | null,"email"?: string | null,"enforce_inventory"?: boolean,"id"?: string,"logo_path"?: string | null,"name"?: string,"next_order_number"?: number,"phone"?: string | null,"pickup_enabled"?: boolean,"pickup_information"?: string | null,"slug"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"units": {
                  Row: {
                    "code": string,"default_step": number,"sort_order": number
                  }
                  Insert: {
                    "code": string,"default_step": number,"sort_order": number
                  }
                  Update: {
                    "code"?: string,"default_step"?: number,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"weekly_cycles": {
                  Row: {
                    "closed_at": string | null,"created_at": string,"id": string,"message": string | null,"order_deadline": string,"published_at": string | null,"status": Database["public"]['Enums']["cycle_status"],"tenant_id": string,"updated_at": string,"week_end": string | null,"week_start": string
                  }
                  Insert: {
                    "closed_at"?: string | null,"created_at"?: string,"id"?: string,"message"?: string | null,"order_deadline": string,"published_at"?: string | null,"status"?: Database["public"]['Enums']["cycle_status"],"tenant_id": string,"updated_at"?: string,"week_end"?: never,"week_start": string
                  }
                  Update: {
                    "closed_at"?: string | null,"created_at"?: string,"id"?: string,"message"?: string | null,"order_deadline"?: string,"published_at"?: string | null,"status"?: Database["public"]['Enums']["cycle_status"],"tenant_id"?: string,"updated_at"?: string,"week_end"?: never,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "weekly_cycles_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "farmer_cycle_product_totals": {
                  Row: {
                    "cycle_id": string | null,"order_count": number | null,"product_id": string | null,"product_name": string | null,"tenant_id": string | null,"total_amount": number | null,"total_quantity": number | null,"unit_code": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_tenant_id_product_id_fkey"
      columns: ["tenant_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                }
          }
          Functions: {
            "claim_notifications":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,
"channel": string,
"created_at": string,
"event": string,
"id": string,
"last_error": string | null,
"locale": string,
"next_attempt_at": string,
"payload": NonNullable<Json>,
"recipient": string,
"sent_at": string | null,
"status": Database["public"]['Enums']["notification_status"],
"tenant_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "notifications"
        isOneToOne: false
        isSetofReturn: true
      } },
"close_cycle":
{ Args: { "p_cycle_id": string }; Returns: undefined
                           },
"copy_cycle":
{ Args: { "p_source_cycle_id": string,"p_week_start": string }; Returns: string
                           },
"place_order":
{ Args: { "p_address_id"?: string,"p_cycle_id": string,"p_delivery_method": Database["public"]['Enums']["delivery_method"],"p_delivery_notes"?: string,"p_idempotency_key": string,"p_items": Json,"p_notes"?: string,"p_phone": string,"p_tenant_slug": string }; Returns: {
              "order_id": string,"order_number": number
            }[]
                           },
"publish_cycle":
{ Args: { "p_cycle_id": string }; Returns: undefined
                           },
"set_order_status":
{ Args: { "p_note"?: string,"p_order_id": string,"p_status": Database["public"]['Enums']["order_status"] }; Returns: undefined
                           }
          }
          Enums: {
            "app_role": "CUSTOMER"|"FARMER"|"PLATFORM_ADMIN","cycle_status": "DRAFT"|"PUBLISHED"|"CLOSED","delivery_method": "DELIVERY"|"PICKUP","notification_status": "PENDING"|"SENT"|"FAILED","order_status": "PLACED"|"CONFIRMED"|"PREPARING"|"READY"|"DELIVERED"|"CANCELLED"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["CUSTOMER", "FARMER", "PLATFORM_ADMIN"],"cycle_status": ["DRAFT", "PUBLISHED", "CLOSED"],"delivery_method": ["DELIVERY", "PICKUP"],"notification_status": ["PENDING", "SENT", "FAILED"],"order_status": ["PLACED", "CONFIRMED", "PREPARING", "READY", "DELIVERED", "CANCELLED"]
          }
        }
} as const
