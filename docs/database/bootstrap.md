# Bootstrapping a hosted environment

A fresh DSA OS database has no organizations and no users. Everything after the first System Administrator is done in the app.

1. In the Supabase dashboard, **Authentication → Users → Invite user**, invite the first administrator's email. (This creates the auth user and, through the trigger, their profile.)
2. In the **SQL editor**, run once, replacing the email:

```sql
with tplco as (
  insert into public.organizations (name, slug, type)
  values ('The Purple Lamb Company', 'tplco', 'tplco')
  returning id
)
insert into public.organization_members (organization_id, user_id, role, status)
select tplco.id, p.id, 'system_administrator', 'invited'
from tplco, public.profiles p
where lower(p.email) = lower('first.admin@example.com');
```

3. The administrator accepts the invitation email, sets a password, and their membership becomes active.
4. From the app, they invite other TPLCo staff (Organizations → The Purple Lamb Company) and create client organizations.
