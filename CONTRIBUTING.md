# Contributing

## Setup

Follow the steps in the README to get the project running locally. You need
Docker, Node.js >= 22, and a Riot Games API key before starting.

## Workflow

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Run the checks below and make sure they all pass.
4. Open a pull request with a clear description of what changed and why.

## Checks

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm test           # Japa test suite
```

Or with make:

```bash
make lint
make typecheck
make test
```

## Code style

The project uses ESLint and Prettier with the AdonisJS config. Run
`npm run lint` to check and `npm run format` to auto-fix formatting.

## Notes

- Keep pull requests focused on a single change.
- Do not commit `.env` files or any credentials.
- Commercial use of this project is not permitted - see `LICENSE`.
