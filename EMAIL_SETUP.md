# Email Integration Setup Guide

## Overview

JobBuilda uses [Resend](https://resend.com) for sending transactional emails (quotes, invoices, notifications).

## Quick Start (Development)

For local development, use the test key (emails won't actually send):

```bash
# In apps/coordinator/.env
RESEND_API_KEY=re_123
EMAIL_FROM_ADDRESS=JobBuilda <noreply@jobbuilda.com>
```

## Production Setup

### 1. Get Resend API Key
1. Sign up at [resend.com](https://resend.com)
2. Get API key from [API Keys](https://resend.com/api-keys)
3. Verify your domain for production sending

### 2. Update Environment
```bash
RESEND_API_KEY=re_prod_your_key
EMAIL_FROM_ADDRESS=Your Company <quotes@yourcompany.com>
```

## Features

- Professional HTML email templates
- PDF attachments for quotes/invoices
- Personalized for each client
- Delivery tracking

## Free Tier
- 100 emails/day
- 3,000 emails/month
- Perfect for getting started!

See Resend docs for more: https://resend.com/docs
