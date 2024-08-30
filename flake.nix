{
  inputs = {
    electron-31-nixpkgs.url = "github:nixos/nixpkgs/a04eac9c5aa7f82e02d6e9e0b203b6eb5704c141";
    node-20-16-nixpkgs.url = "github:nixos/nixpkgs/8a977702729f2d763adc3e214513d517dcb94d9b";
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
          in
          pkgs.mkShell {
            buildInputs = [
              inputs.node-20-16-nixpkgs.legacyPackages.${system}.nodejs_20
              inputs.electron-31-nixpkgs.legacyPackages.${system}.electron
            ];

            packages = [

            ];
            ELECTRON_OVERRIDE_DIST_PATH = "${inputs.electron-31-nixpkgs.legacyPackages.${system}.electron}/bin/";
            ELECTRON_SKIP_BINARY_DOWNLOAD = 1;
            LD_LIBRARY_PATH = "${pkgs.stdenv.cc.cc.lib}/lib64:$LD_LIBRARY_PATH";
          });
    };
}
