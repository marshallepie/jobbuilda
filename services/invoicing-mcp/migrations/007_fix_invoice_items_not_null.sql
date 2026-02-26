    -- ============================================================
    -- Migration 007: Fix remaining NOT NULL blockers on invoice_items
    --
    -- Two columns exist from the original table that the MCP INSERT
    -- does not populate:
    --   line_vat_amount — original column (code uses line_vat instead)
    --   sort_order      — original column with no default
    -- ============================================================

    -- line_vat_amount: make nullable so the INSERT (which writes line_vat) doesn't fail
    ALTER TABLE invoice_items ALTER COLUMN line_vat_amount DROP NOT NULL;

    -- sort_order: add a default of 0 so rows without it are accepted
    ALTER TABLE invoice_items ALTER COLUMN sort_order SET DEFAULT 0;
