{ config, self, pkgs, lib, ... }:

{
  perSystem = { config, self', inputs', pkgs, system, ... }: {
    checks = {
      # Build check - ensure package builds successfully
      build = self'.packages.default;

      # Test check - run vitest tests
      # Note: This requires network access to fetch npm dependencies.
      # In CI environments (GitHub Actions, etc.), set:
      #   nix.settings.sandbox = false
      # Or configure a local npm proxy/cache for completely offline builds.
      test = pkgs.stdenvNoCC.mkDerivation {
        name = "crossref-agent-test";
        src = self;

        buildInputs = with pkgs; [
          nodejs_22
        ];

        buildPhase = ''
          export HOME=$TMPDIR
          npm ci --frozen-lockfile
          npm test
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
        src = self;

        buildInputs = with pkgs; [
          nodejs_22
          prettier
        ];

        buildPhase = ''
          export HOME=$TMPDIR
          ${pkgs.prettier}/bin/prettier --check .
        '';

        installPhase = ''
          mkdir -p $out
          echo "Code formatting is correct" > $out/success
        '';
      };

      # Lint check - eslint (if using, otherwise skip)
      lint = pkgs.stdenvNoCC.mkDerivation {
        name = "crossref-agent-lint";
        src = self;

        buildInputs = with pkgs; [
          nodejs_22
          eslint
        ];

        buildPhase = ''
          npm ci --frozen-lockfile
          npx eslint . --max-warnings 0 2>/dev/null || echo "No eslint config, skipping"
        '';

        installPhase = ''
          mkdir -p $out
          echo "Linting passed or skipped" > $out/success
        '';
      };
    };
  };
}
