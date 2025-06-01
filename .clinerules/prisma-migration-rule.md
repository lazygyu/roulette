# Prisma Migration Rule

- Use `yarn workspace backend prisma migrate dev --create-only` to create a migration file without applying it immediately.
  - Just create the migration file, do not apply it to the database.
- After that, use `yarn workspace backend prisma generate` to generate the Prisma client.
- Using `yarn workspace backend prisma migrate deploy` is for user, so do not use it in the development process.