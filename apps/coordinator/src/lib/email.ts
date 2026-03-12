import { Resend } from 'resend';

// Initialize Resend with API key
// In development, you can use 're_123' as a test key
const resend = new Resend(process.env.RESEND_API_KEY || 're_123');

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ id: string; success: boolean }> {
  try {
    // Use configured from address or default
    const fromAddress = options.from || process.env.EMAIL_FROM_ADDRESS || 'JobBuilda <noreply@jobbuilda.com>';

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
      })),
      replyTo: options.replyTo,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
    });

    if (error) {
      throw new Error(error.message || 'Resend API returned an error');
    }

    return {
      id: data?.id || 'unknown',
      success: true,
    };
  } catch (error: any) {
    console.error('Failed to send email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Generate HTML email template for quote
 */
export function generateQuoteEmail(data: {
  clientName: string;
  quoteNumber: string;
  companyName: string;
  total: string;
  validUntil: string;
  viewUrl?: string;
  depositAmount?: string;
  balanceDue?: string;
  payDepositUrl?: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote from ${data.companyName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: white;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 30px;
      border-bottom: 3px solid #3B82F6;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #3B82F6;
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .header p {
      color: #666;
      margin: 0;
      font-size: 16px;
    }
    .content {
      margin-bottom: 30px;
    }
    .content p {
      margin: 0 0 15px 0;
      font-size: 16px;
    }
    .quote-details {
      background-color: #f8fafc;
      border-left: 4px solid #3B82F6;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .quote-details h2 {
      margin: 0 0 15px 0;
      color: #1f2937;
      font-size: 18px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 15px;
    }
    .detail-label {
      color: #6b7280;
    }
    .detail-value {
      font-weight: 600;
      color: #1f2937;
    }
    .total-amount {
      font-size: 24px;
      color: #3B82F6;
      font-weight: bold;
    }
    .cta-button {
      display: inline-block;
      background-color: #3B82F6;
      color: white;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
    }
    .cta-button:hover {
      background-color: #2563eb;
    }
    .attachment-notice {
      background-color: #fef3c7;
      border: 1px solid #fbbf24;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .attachment-notice p {
      margin: 0;
      color: #92400e;
      font-size: 14px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    .footer p {
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>📋 New Quote</h1>
      <p>from ${data.companyName}</p>
    </div>

    <div class="content">
      <p>Dear ${data.clientName},</p>

      <p>Thank you for your inquiry! We're pleased to provide you with a detailed quote for your project.</p>

      <div class="quote-details">
        <h2>Quote Details</h2>
        <div class="detail-row">
          <span class="detail-label">Quote Number:</span>
          <span class="detail-value">${data.quoteNumber}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Total Amount:</span>
          <span class="detail-value total-amount">${data.total}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Valid Until:</span>
          <span class="detail-value">${data.validUntil}</span>
        </div>
      </div>

      ${data.depositAmount ? `
      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px 20px; margin: 20px 0; border-radius: 4px;">
        <h3 style="margin: 0 0 10px 0; color: #065f46; font-size: 15px;">Payment Terms</h3>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px;">
          <span style="color: #6b7280;">Deposit Required:</span>
          <strong style="color: #065f46;">${data.depositAmount}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
          <span style="color: #6b7280;">Balance on Completion:</span>
          <strong style="color: #374151;">${data.balanceDue}</strong>
        </div>
      </div>
      ` : ''}

      ${data.payDepositUrl ? `
      <div style="text-align: center; margin: 20px 0;">
        <a href="${data.payDepositUrl}" style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
          Pay Deposit Now
        </a>
      </div>
      ` : ''}

      <div class="attachment-notice">
        <p><strong>📎 Your quote is attached as a PDF</strong><br>
        Please review the attached PDF document for complete details including materials, labor, and terms.</p>
      </div>

      ${data.viewUrl ? `
      <div style="text-align: center;">
        <a href="${data.viewUrl}" class="cta-button">
          View Quote Online
        </a>
      </div>
      ` : ''}

      <p>If you have any questions about this quote or would like to discuss the project further, please don't hesitate to reach out. We're here to help!</p>

      <p>We look forward to working with you.</p>

      <p style="margin-top: 30px;">
        <strong>Best regards,</strong><br>
        ${data.companyName}
      </p>
    </div>

    <div class="footer">
      <p>This quote is valid until ${data.validUntil}</p>
      <p>Please keep this email for your records</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate plain text version of quote email
 */
export function generateQuoteEmailText(data: {
  clientName: string;
  quoteNumber: string;
  companyName: string;
  total: string;
  validUntil: string;
}): string {
  return `
New Quote from ${data.companyName}

Dear ${data.clientName},

Thank you for your inquiry! We're pleased to provide you with a detailed quote for your project.

Quote Details:
- Quote Number: ${data.quoteNumber}
- Total Amount: ${data.total}
- Valid Until: ${data.validUntil}

Your quote is attached as a PDF. Please review the attached document for complete details including materials, labor, and terms.

If you have any questions about this quote or would like to discuss the project further, please don't hesitate to reach out. We're here to help!

We look forward to working with you.

Best regards,
${data.companyName}

---
This quote is valid until ${data.validUntil}
Please keep this email for your records
  `.trim();
}

/**
 * Generate HTML notification email for tenant when a quote deposit is received
 */
export function generateDepositReceivedEmail(data: {
  clientName: string;
  quoteNumber: string;
  jobNumber?: string;
  depositAmount: string;
  balanceDue: string;
  companyName: string;
  dashboardUrl?: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deposit Received</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; padding-bottom: 30px; border-bottom: 3px solid #10b981; margin-bottom: 30px;">
      <h1 style="color: #10b981; margin: 0 0 10px 0; font-size: 28px;">Deposit Received</h1>
      <p style="color: #666; margin: 0; font-size: 16px;">${data.companyName}</p>
    </div>

    <p style="font-size: 16px; margin: 0 0 15px 0;">A deposit payment has been received from <strong>${data.clientName}</strong>.</p>

    <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 4px;">
      <h2 style="margin: 0 0 15px 0; color: #065f46; font-size: 18px;">Payment Details</h2>
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 15px;">
        <span style="color: #6b7280;">Quote Number:</span>
        <strong style="color: #1f2937;">${data.quoteNumber}</strong>
      </div>
      ${data.jobNumber ? `
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 15px;">
        <span style="color: #6b7280;">Job Created:</span>
        <strong style="color: #1f2937;">${data.jobNumber}</strong>
      </div>` : ''}
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 15px;">
        <span style="color: #6b7280;">Deposit Received:</span>
        <strong style="color: #10b981; font-size: 18px;">${data.depositAmount}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 15px;">
        <span style="color: #6b7280;">Balance Due on Completion:</span>
        <strong style="color: #1f2937;">${data.balanceDue}</strong>
      </div>
    </div>

    <p style="font-size: 15px; color: #4b5563;">A job has been automatically created and scheduled. You can view and manage it from your dashboard.</p>

    ${data.dashboardUrl ? `
    <div style="text-align: center; margin: 25px 0;">
      <a href="${data.dashboardUrl}" style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        View Job in Dashboard
      </a>
    </div>` : ''}

    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
      <p style="margin: 5px 0;">This is an automated notification from ${data.companyName}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate HTML receipt email for client after paying a quote deposit
 */
export function generateDepositReceiptEmail(data: {
  clientName: string;
  quoteNumber: string;
  quoteTitle: string;
  depositAmount: string;
  balanceDue: string;
  companyName: string;
  companyPhone?: string;
  companyEmail?: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deposit Receipt</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; padding-bottom: 30px; border-bottom: 3px solid #10b981; margin-bottom: 30px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; background-color: #d1fae5; border-radius: 50%; margin-bottom: 16px;">
        <svg width="28" height="28" fill="none" stroke="#10b981" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <h1 style="color: #10b981; margin: 0 0 6px 0; font-size: 26px;">Deposit Confirmed</h1>
      <p style="color: #666; margin: 0; font-size: 15px;">from ${data.companyName}</p>
    </div>

    <p style="font-size: 16px; margin: 0 0 15px 0;">Dear ${data.clientName},</p>

    <p style="font-size: 15px; color: #4b5563; margin: 0 0 20px 0;">
      Your deposit of <strong style="color: #10b981;">${data.depositAmount}</strong> has been received for <strong>${data.quoteTitle}</strong> (Quote ${data.quoteNumber}).
    </p>

    <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 4px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 15px;">
        <span style="color: #6b7280;">Deposit Paid:</span>
        <strong style="color: #10b981;">${data.depositAmount}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 15px;">
        <span style="color: #6b7280;">Balance Due on Completion:</span>
        <strong style="color: #374151;">${data.balanceDue}</strong>
      </div>
    </div>

    <p style="font-size: 15px; color: #4b5563;">
      An engineer has received the job details and will be in touch to arrange a convenient time for access to the premises.
    </p>

    ${(data.companyPhone || data.companyEmail) ? `
    <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Contact Details</p>
      ${data.companyPhone ? `<p style="margin: 0 0 4px 0; font-size: 14px;"><strong>${data.companyName}</strong></p><p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563;">Tel: ${data.companyPhone}</p>` : ''}
      ${data.companyEmail ? `<p style="margin: 0; font-size: 14px; color: #4b5563;">${data.companyEmail}</p>` : ''}
    </div>` : ''}

    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
      <p style="margin: 5px 0;">Please keep this email as your deposit receipt</p>
      <p style="margin: 5px 0;">${data.companyName}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate HTML email template for invoice
 */
export function generateInvoiceEmail(data: {
  clientName: string;
  invoiceNumber: string;
  companyName: string;
  total: string;
  dueDate: string;
  paymentUrl?: string;
  bankName?: string;
  accountName?: string;
  sortCode?: string;
  accountNumber?: string;
  companyPhone?: string;
  companyEmail?: string;
}): string {
  const hasBankDetails = data.accountName && data.sortCode && data.accountNumber;
  const hasContact = data.companyPhone || data.companyEmail;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice from ${data.companyName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: white;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 30px;
      border-bottom: 3px solid #10b981;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #10b981;
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .invoice-details {
      background-color: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 15px;
    }
    .detail-row:last-child { margin-bottom: 0; }
    .total-amount {
      font-size: 24px;
      color: #10b981;
      font-weight: bold;
    }
    .bank-details {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .bank-details h3 {
      margin: 0 0 12px 0;
      color: #1e40af;
      font-size: 15px;
    }
    .cta-button {
      display: inline-block;
      background-color: #10b981;
      color: white;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .contact-box {
      background-color: #f9fafb;
      border-radius: 6px;
      padding: 16px 20px;
      margin: 20px 0;
      font-size: 14px;
      color: #4b5563;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>💰 Invoice</h1>
      <p>from ${data.companyName}</p>
    </div>

    <div class="content">
      <p>Dear ${data.clientName},</p>

      <p>Thank you for your business! Please find your invoice attached.${hasBankDetails ? ' For your convenience, you can quickly make a bank transfer using our banking details below.' : ''}</p>

      <div class="invoice-details">
        <h2>Invoice Details</h2>
        <div class="detail-row">
          <span>Invoice Number:</span>
          <strong>${data.invoiceNumber}</strong>
        </div>
        <div class="detail-row">
          <span>Amount Due:</span>
          <strong class="total-amount">${data.total}</strong>
        </div>
        <div class="detail-row">
          <span>Due Date:</span>
          <strong>${data.dueDate}</strong>
        </div>
      </div>

      ${hasBankDetails ? `
      <div class="bank-details">
        <h3>🏦 Bank Transfer Details</h3>
        <div class="detail-row">
          <span style="color:#6b7280;">Pay To:</span>
          <strong style="color:#1f2937;">${data.accountName}</strong>
        </div>
        <div class="detail-row">
          <span style="color:#6b7280;">Sort Code:</span>
          <strong style="color:#1f2937;">${data.sortCode}</strong>
        </div>
        <div class="detail-row">
          <span style="color:#6b7280;">Account Number:</span>
          <strong style="color:#1f2937;">${data.accountNumber}</strong>
        </div>
        ${data.bankName ? `
        <div class="detail-row">
          <span style="color:#6b7280;">Bank:</span>
          <strong style="color:#1f2937;">${data.bankName}</strong>
        </div>` : ''}
        <p style="margin: 12px 0 0 0; font-size: 13px; color: #1e40af;">Please use your invoice number <strong>${data.invoiceNumber}</strong> as the payment reference.</p>
      </div>
      ` : ''}

      ${data.paymentUrl ? `
      <div style="text-align: center;">
        <a href="${data.paymentUrl}" class="cta-button">
          Pay Invoice Online
        </a>
      </div>
      ` : ''}

      ${hasContact ? `
      <div class="contact-box">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">For any queries regarding this invoice, please contact us:</p>
        ${data.companyPhone ? `<p style="margin: 0 0 4px 0;">📞 Tel: <strong>${data.companyPhone}</strong></p>` : ''}
        ${data.companyEmail ? `<p style="margin: 0;">✉️ <strong>${data.companyEmail}</strong></p>` : ''}
      </div>
      ` : ''}

      <p style="margin-top: 30px;">
        <strong>Best regards,</strong><br>
        ${data.companyName}
      </p>
    </div>

    <div class="footer">
      <p>Payment is due by ${data.dueDate}</p>
    </div>
  </div>
</body>
</html>`;
}
