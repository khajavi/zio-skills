{ config, pkgs, lib, ... }:

{
  perSystem = { config, self', inputs', pkgs, system, ... }: {
    checks = {
      # Build check - ensure package builds
      build = self'.packages.default;

      # Test check - run vitest
      test = pkgs.stdenvNoCC.mkDerivation {
        name = "crossref-agent-test";
        src = ../. ;

        buildInputs = with pkgs; [
          nodejs_22
        ];

        buildPhase = ''
          set -x
          export HOME=$TMPDIR
          if [ -f package-lock.json ]; then
            echo "=== Configuring npm for reliability ==="
            npm config set fetch-timeout 120000
            npm config set fetch-retry-mintimeout 20000
            npm config set fetch-retry-maxtimeout 120000
            npm config set fetch-retries 5
            echo "=== Installing dependencies ==="
            npm ci --frozen-lockfile 2>&1
            echo "=== Running tests ==="
            npm test 2>&1
          else
            echo "No package-lock.json found, skipping test check"
          fi
        '';

        installPhase = ''
          mkdir -p $out
          echo "Tests passed" > $out/success
        '';

        dontStrip = true;
      };

      # Format check - prettier
      format = pkgs.stdenvNoCC.mkDerivation {
        name = "crossref-agent-format";
        src = ../. ;

        buildInputs = with pkgs; [
          nodejs_22
        ];

        buildPhase = ''
          set -x
          export HOME=$TMPDIR
          echo "=== Configuring npm for reliability ==="
          npm config set fetch-timeout 120000
          npm config set fetch-retry-mintimeout 20000
          npm config set fetch-retry-maxtimeout 120000
          npm config set fetch-retries 5
          echo "=== Installing dependencies ==="
          npm ci --frozen-lockfile 2>&1
          echo "=== Checking code formatting with Prettier ==="
          npx prettier --check . 2>&1
        '';

        installPhase = ''
          mkdir -p $out
          echo "Code formatting is correct" > $out/success
        '';
      };

      # Lint check - eslint
      lint = pkgs.stdenvNoCC.mkDerivation {
        name = "crossref-agent-lint";
        src = ../. ;

        buildInputs = with pkgs; [
          nodejs_22
          eslint
        ];

        buildPhase = ''
          set -x
          export HOME=$TMPDIR
          echo "=== Configuring npm for reliability ==="
          npm config set fetch-timeout 120000
          npm config set fetch-retry-mintimeout 20000
          npm config set fetch-retry-maxtimeout 120000
          npm config set fetch-retries 5
          echo "=== Installing dependencies ==="
          npm ci --frozen-lockfile --verbose 2>&1
          echo "=== Running eslint ==="
          # Run eslint with proper file patterns, ignoring dist and node_modules
          npx eslint "**/*.ts" --ignore-pattern "dist/" --ignore-pattern "node_modules/" 2>&1
        '';

        installPhase = ''
          mkdir -p $out
          echo "Linting passed" > $out/success
        '';
      };
    };
  };
}
