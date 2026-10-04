# Email setup (so anyone can sign up with their own address)

The app sends no email itself. Sign-up confirmation and password reset are
emails sent by **Supabase Auth**, and the app asks the person to type the
6-digit code from them. This is Supabase dashboard configuration, so it has to
be done once per Supabase project. None of it can be done from the app's code.

## 0. Point Supabase at the live website (required)

Supabase keeps one **Site URL**, and any link in an email that doesn't carry an
allowed return address goes there. A new project starts with
`http://localhost:3000`, so a confirmation link clicked by anyone but the
developer lands on a page that doesn't exist for them.

**Authentication -> URL Configuration**

| Setting | Value |
|---|---|
| Site URL | `https://dept-store-manager.vercel.app` |
| Redirect URLs | `https://dept-store-manager.vercel.app/**` and, for local testing, `http://localhost:8081/**` |

The app sends each person back to the site they signed up on (live or
localhost), but Supabase only honours an address that is in **Redirect URLs**;
anything else silently falls back to the Site URL. If you use a custom domain
or Vercel preview URLs, add those too.

## 1. Send through your own mail provider (required)

Supabase's built-in mailer is for testing: it only delivers to the email
addresses of your own Supabase organization's members, and it is rate-limited
to a couple of emails an hour. A stranger signing up with their Gmail would get
nothing. Plug in your own SMTP provider:

**Authentication -> Emails -> SMTP Settings -> Enable custom SMTP**

| Field | Value |
|---|---|
| Sender email | an address you control (must be allowed by the provider) |
| Sender name | `Store Books` |
| Host / Port | from your provider |
| Username / Password | from your provider |

Providers that work: a Gmail account with an
[App Password](https://myaccount.google.com/apppasswords) (`smtp.gmail.com`,
port `465`; needs 2-Step Verification on, fine for a small store), or a
transactional service such as Resend, Brevo, Postmark or Amazon SES (better
deliverability; most want you to verify a domain). Check the provider's daily
sending limit against how many people will register.

After saving, raise **Authentication -> Rate Limits -> Emails sent** if the
default is too low for you.

## 2. Use the code templates (required)

**Authentication -> Emails -> Templates**, paste the file's contents into the
matching template and set its subject:

| Supabase template | File | Subject |
|---|---|---|
| Confirm sign up | `confirm-signup.html` | `{{ .Token }} is your Store Books verification code` |
| Reset password | `reset-password.html` | `{{ .Token }} is your Store Books password reset code` |

The default templates contain a link, not the code. The app asks for the
code, so keep `{{ .Token }}` in the body.

## 3. Check the sign-in settings

**Authentication -> Sign In / Providers -> Email** (dashboard labels move
around between releases; look for these names):

- **Confirm email: on.** (It is on for this project today.) This is what makes
  Supabase require the code before an account can sign in.
- **Email OTP length: 6.** The app expects 6 digits (`OTP_LENGTH` in
  `lib/utils/authFlow.ts`; change both together).
- **Email OTP expiration:** the default is long. Ten minutes (600 s) is
  plenty for a code someone is about to type.
- **Minimum password length: 8**, matching the app's own check.

## 4. Try it end to end

1. Open the app, **Create account** with an address you can read, and check
   the inbox (and spam) for the code.
2. Enter it. You should land on the dashboard.
3. Sign out, tap **Forgot password?**, enter the same address, enter the new
   code and a new password.
4. Register a second account with a different address. Each account only
   ever sees its own customers, bills, stock and bank accounts (row-level
   security on every table; `owner_id` is the signed-in user).
