# ChunkFlow Upload SDK Documentation

Documentation website built with VitePress.

## Development

```bash
pnpm dev
```

The site will be available at `http://localhost:5173`.

## Build

```bash
pnpm build
```

The built site will be in `docs/.vitepress/dist`.

## Preview

```bash
pnpm preview
```

## Deployment

### GitHub Pages

The documentation is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

The deployment workflow is defined in `.github/workflows/deploy-docs.yml`.

#### Manual Deployment

To manually trigger a deployment:

1. Go to the Actions tab in GitHub
2. Select the "Deploy Documentation" workflow
3. Click "Run workflow"

#### Setup

To enable GitHub Pages deployment:

1. Go to repository Settings > Pages
2. Set Source to "GitHub Actions"
3. The site will be available at `https://sunny-117.github.io/chunkflow/`

### Custom Domain

To use a custom domain:

1. Add a `CNAME` file to `docs/public/` with your domain
2. Configure DNS settings for your domain
3. Update the `base` in `.vitepress/config.ts`

## Structure

```
docs/
├── .vitepress/
│   ├── config.ts          # VitePress configuration
│   └── dist/              # Build output
├── guide/                 # User guides
│   ├── index.md
│   ├── getting-started.md
│   ├── installation.md
│   └── ...
├── api/                   # API reference
│   ├── protocol.md
│   ├── core.md
│   └── ...
├── examples/              # Code examples
│   ├── react.md
│   ├── vue.md
│   └── ...
└── index.md              # Home page
```

## Contributing

To add or update documentation:

1. Edit the relevant `.md` files
2. Test locally with `pnpm dev`
3. Submit a pull request

## License

MIT
