{ config, pkgs, lib, ... }:

{
  perSystem = { config, self', inputs', pkgs, system, ... }: {
    devShells.default = pkgs.mkShell {
      buildInputs = with pkgs; [
        # Node.js and npm
        nodejs_22

        # TypeScript and build tools
        typescript
        typescript-language-server

        # Code quality tools
        prettier
        eslint

        # Development utilities
        jq
        git
      ];

      shellHook = ''
        echo "Entering crossref-agent development environment"
        echo "Node version: $(node --version)"
        echo "NPM version: $(npm --version)"
        echo ""
        echo "Available commands:"
        echo "  npm install      - Install dependencies"
        echo "  npm run build    - Compile TypeScript"
        echo "  npm test         - Run tests (vitest)"
        echo "  npm run test:watch - Watch mode"
        echo "  npx prettier --check . - Check formatting"
        echo "  npx prettier --write . - Auto-format code"
        echo "  nix flake check  - Run all CI checks locally"
      '';
    };
  };
}
