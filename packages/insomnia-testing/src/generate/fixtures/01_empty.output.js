const { expect } = chai;

// Clear active request before test starts (will be set inside test)
beforeEach(() => insomnia.clearActiveRequest());
