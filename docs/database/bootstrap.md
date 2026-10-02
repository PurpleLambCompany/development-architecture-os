# Bootstrapping an installation

A fresh DSA OS database has no organizations and no users. The first person is a **Principal Architect** (V1-A D7): they hold practice administration and architectural authority by role default, with nothing granted to themselves. Everything after their first sign-in is done in the app.

## Local and pre-production: `pnpm practice:bootstrap`

```bash
pnpm db:start
pnpm practice:bootstrap --email you@example.com --first-name Ada --last-name Lovelace \
  [--practice-name "The Purple Lamb Company"] [--practice-slug tplco]
```

The command:

1. talks only to the local Supabase stack reported by `supabase status`, and refuses any other host;
2. refuses if the app's `NEXT_PUBLIC_SITE_URL` differs from the auth `site_url` in `supabase/config.toml` (the invitation link would not return to the app);
3. refuses if a practice organization already exists, or the email already has an account;
4. invites the person through Supabase Auth, creates the practice organization, and gives them an invited `principal_architect` membership.

The person opens the invitation (locally, in the mail catcher at `http://127.0.0.1:54324`), sets a password and lands in the app. From there they edit the practice (Organizations → the practice → Practice details), invite colleagues, change roles and statuses, resend or revoke invitations, and delegate practice administration on Settings → Practice, all without SQL. The rules they work under are in [ADR-0074](../architecture-decisions/0074-practice-administration-and-architectural-authority.md).

**This command is local and pre-production only (V1-A D6).** It is not the production bootstrap mechanism. V1-B makes the production bootstrap decision.

## Hosted environments (until V1-B decides)

Until V1-B decides how a production practice is established, a hosted environment can be bootstrapped by hand:

1. In the Supabase dashboard, **Authentication → Users → Invite user**, invite the first Principal Architect's email. (This creates the auth user and, through the trigger, their profile.)
2. In the **SQL editor**, run once, replacing the email:

```sql
with tplco as (
  insert into public.organizations (name, slug, type)
  values ('The Purple Lamb Company', 'tplco', 'tplco')
  returning id
)
insert into public.organization_members (organization_id, user_id, role, status)
select tplco.id, p.id, 'principal_architect', 'invited'
from tplco, public.profiles p
where lower(p.email) = lower('first.principal@example.com');
```

3. The Principal Architect accepts the invitation email, sets a password, and their membership becomes active.

The first user must be a Principal Architect: only a Principal Architect can give anyone the Principal Architect, Architect or Researcher role, so an installation started with a System Administrator could never acquire architectural authority from the app.
