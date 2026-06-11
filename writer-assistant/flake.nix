{
  description = "Crossref Agent - Documentation Cross-Reference Assistant";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    systems.url = "github:nix-systems/default";
  };

  outputs = inputs@{ self, flake-parts, systems, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = import systems;

      imports = [
        ./nix/devShell.nix
        ./nix/packages.nix
        ./nix/checks.nix
      ];
    };
}
