{ inputs, lib }:

{
  # Utility to get node version from package.json or use default
  getNodeVersion = nodeVersion: nodeVersion or "20";

  # Standard mkDerivation wrapper for Node projects
  mkNodePackage = { lib, stdenv, nodejs, nodePackages, src, name, ... }@attrs:
    stdenv.mkDerivation (attrs // {
      inherit name src;
      buildInputs = [ nodejs ];
      buildPhase = ''
        npm ci --frozen-lockfile
        npm run build
      '';
      installPhase = ''
        mkdir -p $out/lib
        cp -r lib dist $out/
        cp package.json $out/
      '';
    });
}
