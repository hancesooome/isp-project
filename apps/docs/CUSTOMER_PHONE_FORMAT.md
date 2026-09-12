# Customer phone format

Customer installation contacts are Philippine mobile numbers stored and displayed in E.164 format:

```text
+639XXXXXXXXX
```

Customer forms accept either `09XXXXXXXXX` or `+639XXXXXXXXX`. Ordinary spaces, hyphens, and parentheses are removed before validation. Inputs with a different prefix or digit count are rejected rather than guessed or repaired.

`public.customer_profiles.phone` is the authoritative field. The database migration converts recognizable legacy values while preserving unknown legacy values until a customer corrects them.
