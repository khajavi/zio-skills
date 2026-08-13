# tinytally Documentation Website

This directory contains the Docusaurus documentation site for tinytally.

## Quick Start

### Install dependencies

```bash
yarn install
# or npm install
```

### Start the development server

```bash
yarn start
# or npm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build for production

```bash
yarn build
# or npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Project Structure

- `docusaurus.config.js` — Configuration file for Docusaurus
- `package.json` — npm dependencies and scripts
- `sidebars.js` — (in parent directory) Sidebar configuration
- `docs/` — (in parent directory) Documentation markdown files
- `src/` — Custom pages and styling

## Documentation Structure

The documentation is organized as follows:

- **docs/index.md** — Main landing page
- **docs/guides/index.md** — Index of learning guides
- **docs/guides/understanding-lens.md** — Tutorial on Lens and Prism
- **docs/reference/index.md** — API reference documentation

## Building and Deployment

To build the site for deployment:

```bash
yarn build
```

The static site will be generated in the `build/` directory.

## More Information

For more information about Docusaurus, see the [official documentation](https://docusaurus.io/).
