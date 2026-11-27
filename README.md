# Air Around You

Air Around You is an interactive air-quality assistant. Explore a place on the globe, compare its sample air with Home, and see practical actions for outdoor plans, indoor air, and commuting.

The map uses OpenFreeMap. Air readings, atmospheric effects, and daily plans use labelled sample data. Device location is optional and its coordinates stay in the browser.

## Development

Use Node.js 22.12 or later and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm preview` to serve the production build locally.
