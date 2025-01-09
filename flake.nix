{
  inputs = {
    nixpkgs-unstable.url = "github:nixos/nixpkgs/nixpkgs-unstable";
  };
  outputs = { self, nixpkgs, ... }@inputs:
    let
      forAllSystems = with nixpkgs.lib; f: foldAttrs mergeAttrs { }
        (map (s: { ${s} = f s; }) systems.flakeExposed);
    in
    {
      devShell = forAllSystems
        (system:
          let
            pkgs = nixpkgs.legacyPackages.${system};
            unstable = inputs.nixpkgs-unstable.legacyPackages.${system};
          in
          pkgs.mkShell {
            buildInputs = [
              pkgs.nodejs_20
              pkgs.yarn
            ];

            ELECTRON_OVERRIDE_DIST_PATH = "${unstable.electron_33}/bin/";
            ELECTRON_SKIP_BINARY_DOWNLOAD = 1;
            LD_LIBRARY_PATH = "${pkgs.stdenv.cc.cc.lib}/lib64:$LD_LIBRARY_PATH";
          });
    };
}
