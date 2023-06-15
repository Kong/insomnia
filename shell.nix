with import <nixpkgs> {};

mkShell {
    nativeBuildInputs = [
        nodejs-16_x
        electron_22
        stdenv.cc.cc.lib
    ];
    LD_LIBRARY_PATH = "${stdenv.cc.cc.lib}/lib64:$LD_LIBRARY_PATH";
    ELECTRON_OVERRIDE_DIST_PATH = "${electron_22}/bin/";
}
