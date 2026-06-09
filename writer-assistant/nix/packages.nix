{ self, config, pkgs, lib, ... }:

{
  perSystem = { config, self', inputs', pkgs, system, ... }: {
    packages = {
      default = self'.packages.crossref-agent;

      crossref-agent = pkgs.stdenvNoCC.mkDerivation {
        name = "crossref-agent-0.1.0";
        src = self;

        buildInputs = with pkgs; [
          nodejs_22
        ];

        # Build phase: install dependencies and compile
        buildPhase = ''
          export HOME=$TMPDIR
          npm ci --frozen-lockfile || true
          npm run build || true
        '';

        # Copy built artifacts and sources to output
        installPhase = ''
          mkdir -p $out

          # Copy source files
          cp -r lib $out/ 2>/dev/null || true
          cp -r dist $out/ 2>/dev/null || true
          cp -r agents $out/ 2>/dev/null || true
          cp -r tools $out/ 2>/dev/null || true
          cp -r workflows $out/ 2>/dev/null || true
          cp -r skills $out/ 2>/dev/null || true
          cp -r tests $out/ 2>/dev/null || true

          # Copy configuration files
          cp package.json $out/ 2>/dev/null || true
          cp package-lock.json $out/ 2>/dev/null || true
          cp tsconfig.json $out/ 2>/dev/null || true

          # Ensure output directories exist
          mkdir -p $out/dist
          mkdir -p $out/lib
        '';

        dontStrip = true;
      };
    };
  };
}
