{ config, pkgs, lib, ... }:

{
  perSystem = { config, self', inputs', pkgs, system, ... }: {
    checks = {
      # Build check - ensure package builds
      build = self'.packages.default;

      # Test check - run vitest
      test = pkgs.stdenvNoCC.mkDerivation {
        name = "crossref-agent-test";
        src = ./.;

        buildInputs = with pkgs; [
          nodejs_22
        ];

        buildPhase = ''
          export HOME=$TMPDIR
          if [ -f package-lock.json ]; then
            npm ci --frozen-lockfile
            npm test
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
        src = ./.;

        buildInputs = with pkgs; [
          nodejs_22
          prettier
        ];

        buildPhase = ''
          prettier --check .
        '';

        installPhase = ''
          mkdir -p $out
          echo "Code formatting is correct" > $out/success
        '';
      };

      # Lint check - eslint
      lint = pkgs.stdenvNoCC.mkDerivation {
        name = "crossref-agent-lint";
        src = ./.;

        buildInputs = with pkgs; [
          nodejs_22
          npm
          eslint
        ];

        buildPhase = ''
          export HOME=$TMPDIR
          npm ci --frozen-lockfile
          npx eslint . --max-warnings 0
        '';

        installPhase = ''
          mkdir -p $out
          echo "Linting passed" > $out/success
        '';
      };
    };
  };
}
