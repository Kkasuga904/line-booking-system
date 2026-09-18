# Security

Never commit `.env`, `*.env`, Terraform variable files, state files, credentials, or generated dependencies.

Terraform creates the Secret Manager containers but intentionally does not manage secret payloads, because payloads are retained in Terraform state. Add or rotate each secret out of band after `terraform apply`:

```bash
printf '%s' "$LINE_CHANNEL_ACCESS_TOKEN" | gcloud secrets versions add line-channel-access-token --data-file=-
printf '%s' "$LINE_CHANNEL_SECRET" | gcloud secrets versions add line-channel-secret --data-file=-
printf '%s' "$SUPABASE_URL" | gcloud secrets versions add supabase-url --data-file=-
printf '%s' "$SUPABASE_ANON_KEY" | gcloud secrets versions add supabase-anon-key --data-file=-
```

If a credential is ever committed, revoke and rotate it immediately. Removing it in a later commit does not remove it from Git history.
