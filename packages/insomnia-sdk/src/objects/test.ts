export function test(
    msg: string,
    fn: () => void,
    log: (message?: any, ...optionalParams: any[]) => void,
) {
    try {
        fn();
        log(`✓ ${msg}`);
    } catch (e) {
        log(`✕ ${msg}: ${e}`);
    }
}
