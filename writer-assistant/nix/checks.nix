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
    };
  };
}
