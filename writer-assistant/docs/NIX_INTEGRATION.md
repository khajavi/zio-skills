# Nix Integration Guide — Crossref Agent

## Overview

The crossref-agent has a complete, self-contained Nix flake setup that works independently. This document covers:

1. **Current State** — Independent flake with full CI/CD integration
2. **Workspace Integration Patterns** — How to integrate into the parent zio-skills workspace if needed
3. **Testing & Verification** — How to verify independence and integration
4. **Future Expansion** — Guidance for adding to parent workspace flake

---

## Current Architecture

### Independent Flake Structure

```
crossref-agent/
├── flake.nix                 # Root flake configuration
├── nix/
│   ├── devShell.nix         # Development environment
│   ├── packages.nix         # Package definition
│   ├── checks.nix           # All CI checks (build, test, lint, format)
│   └── lib.nix              # Shared utilities
├── .github/workflows/
│   └── ci.yml               # GitHub Actions CI using nix flake check
└── package.json             # TypeScript project definition
```

### Flake Outputs (Current)

The crossref-agent flake exposes:

**Checks** (for `nix flake check`):

- `checks.<system>.build` — Compile TypeScript and verify build
- `checks.<system>.test` — Run Vitest suite
- `checks.<system>.lint` — Run ESLint on source code
- `checks.<system>.format` — Check Prettier formatting (read-only)

**Dev Shells**:

- `devShells.<system>.default` — Full development environment with Node.js, TypeScript, ESLint, Prettier

**Packages**:

- `packages.<system>.crossref-agent` — Built package
- `packages.<system>.default` — Alias to crossref-agent

### Supported Platforms

The flake is configured for multi-platform support:

- `x86_64-linux` (primary CI platform)
- `x86_64-darwin` (macOS Intel)
- `aarch64-linux` (Linux ARM64)
- `aarch64-darwin` (macOS Apple Silicon)

Checks run on all platforms via `nix flake check --all-systems`.

---

## Independent Verification

### Test Flake Shows All Outputs

```bash
cd crossref-agent
nix flake show
```

Expected output shows checks, devShells, and packages for all platforms without parent workspace involvement.

### Test Development Shell

```bash
nix develop
npm install
npm run build
npm test
npm run lint
npm run format
```

All operations work in isolation.

### Test GitHub Actions CI

The `.github/workflows/ci.yml` runs:

```bash
nix flake check
```

This command verifies all checks pass without requiring parent workspace configuration.

---

## Workspace Integration Patterns

### Pattern 1: Monorepo Subflake (Recommended for Future)

If the parent zio-skills workspace adds a flake.nix in the future, crossref-agent can be integrated as a subflake:

**Parent `/home/milad/sources/zio-skills/flake.nix`:**

```nix
{
  description = "ZIO Skills — Developer Skills and Utilities";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    systems.url = "github:nix-systems/default";

    # Add crossref-agent as a subflake input
    crossref-agent = {
      url = "path:./crossref-agent";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.flake-parts.follows = "flake-parts";
      inputs.systems.follows = "systems";
    };
  };

  outputs = inputs@{ self, flake-parts, systems, crossref-agent, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = import systems;

      # Merge crossref-agent checks into workspace checks
      flake.checks = {
        inherit (crossref-agent.checks) crossref;
      };

      # Include crossref-agent package in workspace
      flake.packages = {
        inherit (crossref-agent.packages) crossref-agent;
      };

      # Merge development shells
      perSystem = { config, pkgs, system, ... }: {
        devShells.default = pkgs.mkShell {
          inputsFrom = [
            crossref-agent.devShells.${system}.default
          ];
          # Add workspace-level tools here
        };
      };
    };
}
```

**Benefits:**

- ✅ Unified CI/CD across workspace (single `nix flake check` for all projects)
- ✅ Shared nixpkgs version across all subprojects
- ✅ Consistent development environments
- ✅ Each subproject remains independently testable

**Considerations:**

- Parent and child flakes share inputs to avoid redundant evaluations
- Use `inputs.*.follows` to ensure version alignment
- Each subflake can still be tested independently

### Pattern 2: Workspace Monorepo without Flake

The current setup (no parent flake.nix) is valid for:

- Projects that don't require workspace-level orchestration
- CI/CD that runs per-project (current GitHub Actions approach)
- Separate version management per project
- Independent deployment cycles

This is the **current recommended pattern** for zio-skills given its mixed Scala/Nix/TypeScript nature.

---

## Workspace Integration Checklist

If integrating crossref-agent into a future parent flake.nix:

- [ ] Parent flake created at `/home/milad/sources/zio-skills/flake.nix`
- [ ] Parent inputs configured with `inputs.nixpkgs.follows` to align versions
- [ ] Crossref-agent added as path input: `url = "path:./crossref-agent"`
- [ ] Parent inherits/merges crossref-agent outputs (checks, packages, devShells)
- [ ] Update parent GitHub Actions to run `nix flake check --all-systems`
- [ ] Verify `nix flake show` from parent includes all crossref-agent outputs
- [ ] Test `nix develop` from parent includes crossref-agent dependencies
- [ ] Document any breaking changes to independent test procedures

---

## Current CI/CD Flow

### GitHub Actions

Location: `.github/workflows/ci.yml`

**Trigger:**

- Push to `main` or `ci-*` branches
- Pull request to `main`

**Steps:**

1. Checkout repository
2. Install Nix (Determinate Systems installer)
3. Enable magic-nix-cache for faster builds
4. Run `nix flake check`

**Outputs:**

- ✅ All checks pass → workflow succeeds
- ❌ Any check fails → workflow fails with detailed error

### Local Development

```bash
# Enter development shell (includes all tools)
nix develop

# Run all checks locally (mirrors CI)
nix flake check

# Run individual checks
nix build .#checks.x86_64-linux.build
nix build .#checks.x86_64-linux.test
nix build .#checks.x86_64-linux.lint
nix build .#checks.x86_64-linux.format
```

---

## Troubleshooting Workspace Integration

### Issue: Parent Flake Can't Find Crossref-Agent

**Symptom:** `error: attribute 'crossref-agent' missing`

**Solution:**

```bash
# Update flake inputs
nix flake update

# Verify path is correct
ls -la /home/milad/sources/zio-skills/crossref-agent/flake.nix
```

### Issue: Input Version Conflicts

**Symptom:** `error: infinite recursion in flake input`

**Solution:** Use `inputs.*.follows` to pin shared inputs:

```nix
crossref-agent = {
  url = "path:./crossref-agent";
  inputs.nixpkgs.follows = "nixpkgs";      # Follow parent's nixpkgs
  inputs.flake-parts.follows = "flake-parts";
  inputs.systems.follows = "systems";
};
```

### Issue: Checks Run on Wrong System

**Symptom:** `nix flake check` only runs x86_64 checks

**Solution:**

```bash
# Run all platform checks (slower, but comprehensive)
nix flake check --all-systems

# Or add to parent flake.nix:
flakezz.outputs = inputs: {
  flake = {
    inherit (inputs.self) systems;
  };
};
```

---

## References

- **Crossref-Agent Flake Root:** `/home/milad/sources/zio-skills/crossref-agent/flake.nix`
- **Development Environment:** `/home/milad/sources/zio-skills/crossref-agent/nix/devShell.nix`
- **All Checks:** `/home/milad/sources/zio-skills/crossref-agent/nix/checks.nix`
- **Package Definition:** `/home/milad/sources/zio-skills/crossref-agent/nix/packages.nix`
- **CI Workflow:** `/home/milad/sources/zio-skills/crossref-agent/.github/workflows/ci.yml`

---

## Summary

**Today:** Crossref-agent has a complete, independent Nix flake that works standalone. All CI/CD runs via `nix flake check` with no parent workspace dependency.

**Tomorrow:** When/if parent zio-skills adds a flake.nix, integration is straightforward via subflake pattern with `inputs.*.follows` to ensure version alignment.

**Independence:** Even after integration, crossref-agent can always be tested independently:

```bash
cd crossref-agent
nix flake check
```

This design ensures the project is both self-contained and workspace-friendly.
