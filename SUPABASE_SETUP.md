# Supabase Authentication Setup

JobBuilda uses Supabase for authentication and multi-tenant user management. This guide will help you set up Supabase for your project.

## Development Mode (No Setup Required)

For local development, JobBuilda works out of the box without Supabase configuration. The app will use mock authentication automatically when Supabase credentials are not provided.

**To use development mode:** Simply leave the Supabase environment variables empty in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

You can sign in with any email/password combination, and the app will create a mock session with a temporary tenant ID.

## Production Setup (Supabase)

For production use, follow these steps to set up Supabase authentication:

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create an account
2. Click "New Project"
3. Fill in your project details:
   - **Name**: JobBuilda (or your company name)
   - **Database Password**: Choose a strong password
   - **Region**: Select the closest region to your users
4. Wait for the project to be created (~2 minutes)

### 2. Get Your API Credentials

1. In your Supabase project dashboard, go to **Settings > API**
2. Copy the following values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **Anon/Public Key** (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### 3. Configure Environment Variables

Update `apps/admin/.env.local` with your credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set Up User Metadata Schema

JobBuilda stores tenant information in user metadata. When users sign up, the following metadata fields are set:

```typescript
{
  tenant_id: string;  // UUID for multi-tenancy
  company_name: string;  // Business name
  role: string;  // User role (admin, technician, etc.)
}
```

### 5. Configure Email Templates (Optional)

1. Go to **Authentication > Email Templates** in Supabase
2. Customize the email templates for:
   - Confirmation emails
   - Password reset emails
   - Magic link emails

### 6. Set Up Row Level Security (Optional but Recommended)

For production, you should set up Row Level Security policies in Supabase to ensure data isolation between tenants.

Example policy for a `clients` table:

```sql
CREATE POLICY "Users can only access their tenant's data"
ON clients
FOR ALL
USING (tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid);
```

## Testing Authentication

### Development Mode

1. Start the dev server: `pnpm dev:core`
2. Navigate to `http://localhost:3002/login`
3. Enter any email and password
4. You'll be signed in with a mock session

### Production Mode

1. Ensure Supabase credentials are set in `.env.local`
2. Navigate to `http://localhost:3002/signup`
3. Create a new account with your email
4. Check your email for the confirmation link
5. Sign in with your credentials

## Multi-Tenancy

JobBuilda is designed as a multi-tenant SaaS application:

- Each user belongs to one **tenant** (company/organization)
- The `tenant_id` is stored in user metadata
- All API requests include the tenant_id in headers
- MCP services filter data by tenant_id
- Each contractor business is a separate tenant

When a user signs up:
1. A new `tenant_id` (UUID) is generated
2. This is stored in the user's metadata
3. All subsequent API calls use this tenant_id for data isolation

## Troubleshooting

### "Invalid login credentials" error

- In development mode: This shouldn't happen - any credentials work
- In production mode: Check that the email/password are correct
- Verify your Supabase project is active

### User metadata not saving

- Ensure you're passing metadata in the signup call:
  ```typescript
  await signUp(email, password, {
    tenant_id: uuid(),
    company_name: companyName,
    role: 'admin'
  });
  ```

### Session not persisting

- Check browser console for errors
- Verify Supabase credentials are correct
- Clear browser storage and try again

## Migration from Mock Auth

All pages in JobBuilda automatically use real Supabase authentication when configured. No code changes are needed - just add your Supabase credentials to `.env.local` and restart the dev server.

The `useApi()` hook automatically syncs authentication tokens from Supabase to the API client.

## Security Notes

- **Never commit** `.env.local` to version control
- Use `.env.local.example` as a template
- In production, use environment variables from your hosting platform
- Enable MFA (Multi-Factor Authentication) in Supabase for admin accounts
- Regularly rotate your Supabase service role key (not used in this app)
- Monitor authentication logs in Supabase dashboard
