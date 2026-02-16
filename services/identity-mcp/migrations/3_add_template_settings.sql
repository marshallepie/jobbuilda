-- Migration: Add template settings to tenants table
-- This adds fields for managing invoice and quote template preferences

ALTER TABLE tenants
  ADD COLUMN invoice_template_id VARCHAR(50) DEFAULT 'modern',
  ADD COLUMN quote_template_id VARCHAR(50) DEFAULT 'modern',
  ADD COLUMN template_font VARCHAR(50) DEFAULT 'Inter',
  ADD COLUMN show_payment_qr BOOLEAN DEFAULT false,
  ADD COLUMN show_item_codes BOOLEAN DEFAULT true,
  ADD COLUMN show_item_descriptions BOOLEAN DEFAULT true,
  ADD COLUMN footer_text TEXT,
  ADD COLUMN header_image_url TEXT;

COMMENT ON COLUMN tenants.invoice_template_id IS 'Selected invoice template layout (modern, classic, minimal, detailed)';
COMMENT ON COLUMN tenants.quote_template_id IS 'Selected quote template layout (modern, classic, minimal, detailed)';
COMMENT ON COLUMN tenants.template_font IS 'Font family for generated PDFs';
COMMENT ON COLUMN tenants.show_payment_qr IS 'Display QR code for payment on invoices';
COMMENT ON COLUMN tenants.show_item_codes IS 'Display SKU/item codes on line items';
COMMENT ON COLUMN tenants.show_item_descriptions IS 'Display item descriptions on line items';
COMMENT ON COLUMN tenants.footer_text IS 'Custom footer text for invoices and quotes';
COMMENT ON COLUMN tenants.header_image_url IS 'Optional header banner image URL';
