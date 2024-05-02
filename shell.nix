with import <nixpkgs> { };

mkShell {
  nativeBuildInputs = [
    nodejs-20_x
    electron_30
    stdenv.cc.cc.lib
  ];
  LD_LIBRARY_PATH = "${stdenv.cc.cc.lib}/lib64:$LD_LIBRARY_PATH";
  ELECTRON_OVERRIDE_DIST_PATH = "${electron_30}/bin/";
  ELECTRON_SKIP_BINARY_DOWNLOAD = 1;
}
