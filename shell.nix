with import <nixpkgs> {};

mkShell {
    nativeBuildInputs = [
        nodejs-16_x
        electron_22
    ];

    ELECTRON_OVERRIDE_DIST_PATH = "${electron_22}/bin/";
}
