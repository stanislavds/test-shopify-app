# Deployment Guide - Database Setup

This guide explains how to set up a remote PostgreSQL database for deploying your Shopify app to production and testing on different stores.

## Why Remote Database?

- **Accessibility**: Multiple environments (dev, staging, production) can access the same database
- **Persistence**: Data survives local machine restarts
- **Scalability**: Hosted databases are optimized for production workloads
- **Multi-store support**: All stores share the same database instance

## Step 1: Choose a PostgreSQL Provider

Recommended providers (all offer free tiers for development):

### Option 1: Neon (Recommended for Startups)
- **Free tier**: 0.5 GB storage, unlimited projects
- **URL**: https://neon.tech
- **Pros**: Serverless, auto-scaling, great developer experience
- **Setup**: Sign up → Create project → Copy connection string

### Option 2: Supabase
- **Free tier**: 500 MB database, 2 GB bandwidth
- **URL**: https://supabase.com
- **Pros**: Includes additional features (auth, storage, realtime)
- **Setup**: Sign up → New project → Settings → Database → Connection string

### Option 3: Railway
- **Free tier**: $5 credit/month
- **URL**: https://railway.app
- **Pros**: Simple deployment, good for full-stack apps
- **Setup**: Sign up → New project → PostgreSQL → Copy connection string

### Option 4: Render
- **Free tier**: 90-day free trial
- **URL**: https://render.com
- **Pros**: Simple setup, good documentation
- **Setup**: New PostgreSQL → Copy connection string

### Option 5: DigitalOcean
- **Paid**: Starts at $15/month
- **URL**: https://www.digitalocean.com/products/managed-databases
- **Pros**: Reliable, production-ready
- **Setup**: Create database → Copy connection string

## Step 2: Create Your Database

1. Sign up for your chosen provider
2. Create a new PostgreSQL database
3. Copy the connection string (it will look like):
   ```
   postgresql://user:password@host:port/database?sslmode=require
   ```

## Step 3: Set Up Environment Variables

### For Local Development

Create a `.env` file in your project root (if it doesn't exist):

```bash
# Database
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# Shopify (these are usually set by `shopify app dev`)
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-app-url.com
SCOPES=write_products,read_products
```

**Important**: Add `.env` to your `.gitignore` file to avoid committing secrets!

### For Production/Deployment

Set environment variables in your hosting platform:

- **Fly.io**: `fly secrets set DATABASE_URL="..."`
- **Render**: Dashboard → Environment → Add Environment Variable
- **Railway**: Variables tab → Add Variable
- **Google Cloud Run**: `gcloud run services update ... --set-env-vars DATABASE_URL="..."`
- **Heroku**: `heroku config:set DATABASE_URL="..."`

## Step 4: Run Migrations on Remote Database

Once you have your `DATABASE_URL` set, run migrations:

```bash
# Generate Prisma client
npx prisma generate

# Run migrations on the remote database
npx prisma migrate deploy
```

Or use the setup script:
```bash
npm run setup
```

This will create all necessary tables (Session, Shop) in your remote database.

## Step 5: Verify Database Connection

Test your connection:

```bash
npm run db:check
```

This will show you:
- Number of sessions and shops
- Recent sessions
- All shop records

## Step 6: Deploy Your App

Follow the deployment guide in the README for your chosen hosting platform:

- [Google Cloud Run](https://shopify.dev/docs/apps/launch/deployment/deploy-to-google-cloud-run)
- [Fly.io](https://fly.io/docs/js/shopify/)
- [Render](https://render.com/docs/deploy-shopify-app)

**Important**: Make sure to set all required environment variables in your hosting platform:
- `DATABASE_URL`
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`
- `SCOPES`
- `NODE_ENV=production`

## Managing Multiple Environments

### Option 1: Separate Databases (Recommended)
- **Development**: One database (e.g., `myapp-dev`)
- **Production**: Another database (e.g., `myapp-prod`)
- Use different `DATABASE_URL` values for each environment

### Option 2: Single Database with Environment Tags
- Use the same database but add an `environment` field to your Shop model
- Filter shops by environment in your queries

### Option 3: Schema Prefixes
- Use different schemas in the same database
- Modify `DATABASE_URL` to include schema: `?schema=production` or `?schema=development`

## Troubleshooting

### Connection Issues

**Error**: `Can't reach database server`
- Check your `DATABASE_URL` is correct
- Verify your IP is whitelisted (some providers require this)
- Check firewall settings

**Error**: `SSL connection required`
- Add `?sslmode=require` to your connection string
- Some providers require SSL by default

### Migration Issues

**Error**: `Migration failed`
- Make sure you're connected to the right database
- Check if tables already exist: `npx prisma db pull` to inspect
- Reset if needed (⚠️ deletes all data): `npx prisma migrate reset`

### Environment Variable Issues

**Error**: `DATABASE_URL is not set`
- Verify `.env` file exists and has `DATABASE_URL`
- For production, check hosting platform environment variables
- Use `echo $DATABASE_URL` to verify it's set

## Best Practices

1. **Never commit `.env` files** - Use `.gitignore`
2. **Use connection pooling** - Most providers handle this automatically
3. **Backup regularly** - Set up automated backups in your provider
4. **Monitor usage** - Watch your database size and connection limits
5. **Use migrations** - Always use Prisma migrations, never manual SQL changes
6. **Test locally first** - Test database changes locally before deploying

## Quick Reference

```bash
# Generate Prisma client
npx prisma generate

# Create and run migrations
npx prisma migrate dev

# Deploy migrations to production
npx prisma migrate deploy

# Check database status
npm run db:check

# Open Prisma Studio (database GUI)
npm run prisma:studio

# View database schema
npx prisma db pull
```

