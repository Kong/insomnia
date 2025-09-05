{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
  };
  outputs =
    { nixpkgs, ... }:
    let
      forAllSystems =
        with nixpkgs.lib;
        f: foldAttrs mergeAttrs { } (map (s: { ${s} = f s; }) systems.flakeExposed);
    in
    {
      devShell = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs_22
            pkgs.yarn
          ];

          ELECTRON_OVERRIDE_DIST_PATH = "${pkgs.electron_37}/bin/";
          ELECTRON_SKIP_BINARY_DOWNLOAD = 1;
          LD_LIBRARY_PATH = nixpkgs.lib.makeLibraryPath [ pkgs.stdenv.cc.cc ];
        }
      );
    };
}
