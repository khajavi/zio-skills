# Nix Configuration for Writer Assistant

This directory contains Nix Flake configurations that define the development environment, build process, and continuous integration checks for the writer-assistant project.

## Overview

The Nix Flake setup provides:

- **Reproducible development environment** via `devShell.nix`
- **Build and packaging** configuration via `packages.nix`
- **Automated CI checks** (build, test, format, lint) via `checks.nix`
- **Shared utility functions** via `lib.nix`

## File Structure

### `devShell.nix`

Defines the development environment accessed via `nix develop` or `nix flake enter`.

**Includes:**

- Node.js 22 runtime
- TypeScript compiler and language server
- Code quality tools: Prettier (formatter), ESLint (linter)
- Utilities: jq, git

**Entry point:** When you enter the dev shell, you get:

```bash
$ nix develop
Entering crossref-agent development environment
Node version: v22.22.3
NPM version: 10.9.8

Available commands:
  npm install      - Install dependencies
  npm run build    - Compile TypeScript
  npm test         - Run tests (vitest)
  npm run test:watch - Watch mode
  npx prettier --check . - Check formatting
  npx prettier --write . - Auto-format code
  nix flake check  - Run all CI checks locally
```

### `packages.nix`

Defines how the project is built and packaged.

**Package:** `crossref-agent` (default)

- Installs dependencies with `npm ci --frozen-lockfile`
- Builds TypeScript with `npm run build`
- Packages built artifacts and source files for distribution
- Includes: dist/, lib/, agents/, tools/, workflows/, skills/, tests/, and config files

### `checks.nix`

Defines automated checks that run during CI and locally.

**Four checks implemented:**

1. **build** - Ensures the package builds successfully
   - Reuses the default package definition
   - Catches compilation errors

2. **test** - Runs unit tests with vitest
   - Command: `npm ci --frozen-lockfile && npm test`
   - Skips gracefully if `package-lock.json` is missing

3. **format** - Checks code formatting with Prettier
   - Command: `prettier --check .`
   - Ensures consistent code style across the project
   - Run `prettier --write .` to auto-fix issues

4. **lint** - Runs TypeScript linting with ESLint
   - Command: `npx eslint "**/*.ts" --ignore-pattern "dist/" --ignore-pattern "node_modules/"`
   - Validates code quality and catches potential bugs
   - Ignores build artifacts and dependencies

### `lib.nix`

Provides reusable utility functions for Node.js projects.

**Functions:**

- `getNodeVersion` - Helper to extract or default Node version
- `mkNodePackage` - Standard derivation wrapper for Node projects (currently unused but available for future use)

## Usage

### Development Workflow

```bash
# Enter development environment
nix develop

# Inside nix develop:
npm install      # Install dependencies
npm run build    # Compile TypeScript
npm test         # Run tests
npm run test:watch  # Watch mode for development

# Check code formatting
npx prettier --check .
npx prettier --write .  # Auto-fix

# Run all CI checks locally
nix flake check
```

### Building the Package

```bash
# Build the default package
nix build

# Output is in ./result/
ls result/
# dist/  lib/  agents/  tools/  workflows/  skills/  tests/  package.json  ...
```

### Running Individual Checks

```bash
# Run only the format check
nix build .#checks.<system>.format

# Run only the lint check
nix build .#checks.<system>.lint

# Run only tests
nix build .#checks.<system>.test
```

Replace `<system>` with your system (e.g., `x86_64-linux` or `aarch64-darwin`).

## GitHub Actions Integration

The root `.github/workflows/ci.yml` runs `nix flake check` which automatically executes all four checks:

- Install Nix
- Use Magic Nix Cache for faster builds
- Run `cd writer-assistant && nix flake check`

All checks must pass before merging to main.

## Common Issues & Solutions

### Issue: "prettier --check" fails with formatting warnings

**Solution:** Auto-format with Prettier:

```bash
nix develop -c npx prettier --write .
```

### Issue: ESLint reports linting errors

**Solution:** Check the specific files and fix according to the rules:

```bash
nix develop -c npx eslint "**/*.ts"
```

### Issue: Tests fail

**Solution:** Run tests in watch mode for debugging:

```bash
nix develop -c npm run test:watch
```

### Issue: Build fails in CI but works locally

**Solution:** Verify you're using the exact same dependencies:

```bash
npm ci --frozen-lockfile  # Use lock file
nix flake check           # Use Nix for isolated builds
```

## Maintenance

### Updating Node.js Version

To update Node.js (currently v22):

1. **devShell.nix:** Change `nodejs_22` to `nodejs_23` (or desired version)
2. **packages.nix:** Update `nodejs_22` in buildInputs
3. **checks.nix:** Update `nodejs_22` in all check buildInputs

Example:

```nix
buildInputs = with pkgs; [
  nodejs_23  # Updated
  # ... rest
];
```

### Adding New Checks

To add a new check (e.g., type checking):

1. Add a new derivation in `checks.nix`:

```nix
typecheck = pkgs.stdenvNoCC.mkDerivation {
  name = "writer-assistant-typecheck";
  src = ../. ;

  buildInputs = with pkgs; [ nodejs_22 ];

  buildPhase = ''
    npm ci --frozen-lockfile
    npx tsc --noEmit
  '';

  installPhase = ''
    mkdir -p $out
    echo "Type checking passed" > $out/success
  '';
};
```

2. It will automatically be included in `nix flake check`

### Adding Dependencies to Dev Shell

To add a tool to the development environment:

1. Edit `devShell.nix`
2. Add to `buildInputs`:

```nix
buildInputs = with pkgs; [
  nodejs_22
  # ... existing tools
  newTool    # Add here
];
```

3. Optionally add to `shellHook` instructions

## Performance Tips

- **Magic Nix Cache:** GitHub Actions uses `DeterminateSystems/magic-nix-cache-action@main` to cache build artifacts and speed up CI
- **Frozen lockfile:** Always use `npm ci --frozen-lockfile` for reproducible builds
- **Local caching:** First `nix flake check` is slow; subsequent runs are faster thanks to caching

## Resources

- [Nix Flakes Documentation](https://nixos.wiki/wiki/Flakes)
- [flake-parts](https://flake.parts/) - Framework used for modular Nix configuration
- [Prettier Documentation](https://prettier.io/)
- [ESLint Documentation](https://eslint.org/)
