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
          set -x
          export HOME=$TMPDIR
          echo "=== Installing dependencies ==="
          npm ci --frozen-lockfile 2>&1
          echo "=== Building TypeScript ==="
          npm run build 2>&1
        '';

        # Copy built artifacts and sources to output
        installPhase = ''
          mkdir -p $out/{dist,lib,agents,tools,workflows,skills,tests}

          # Copy built artifacts (required after build)
          cp -r dist $out/
          cp -r lib $out/

          # Copy source directories if they exist (optional)
          [ -d agents ] && cp -r agents $out/
          [ -d tools ] && cp -r tools $out/
          [ -d workflows ] && cp -r workflows $out/
          [ -d skills ] && cp -r skills $out/
          [ -d tests ] && cp -r tests $out/

          # Copy config files (required)
          cp package.json package-lock.json tsconfig.json $out/
        '';

        dontStrip = true;
      };
    };
  };
}
