# MacOS Codesigning entitlements

This readme contains documentation for the codesigning entitlements defined in `codesign.entitlements`

## `com.apple.security.cs.disable-library-validation`

[Reference](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_security_cs_disable-library-validation)

`node-libcurl` is recognized as a library used by the Inso CLI, however because it is not signed by Apple nor by the same Team ID as the same executable, we must switch this entitlement on to allow the Inso CLI binary to access `node-libcurl`.

## `com.apple.security.cs.allow-unsigned-executable-memory`

[Reference](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_security_cs_allow-unsigned-executable-memory)

This entitlement is likely needed due to the version of V8 includeded in Node 12. Modern versions follow `MAP_JIT` restrictions, but it is likely the Node version Inso CLI is currently built with (due to a the bundled version of `node-libcurl`) does not follow restrictions correctly.
