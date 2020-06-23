describe('Parent Suite', () => {
  describe('Nested Suite', () => {
    describe('Nested Again Suite', () => {
      it('should return -1 when the value is not present', async () => {
        expect([1, 2, 3].indexOf(4)).toBe(-1);
        expect(true).toBe(true);
      });

      it('should be true', async () => {
        expect(true).toBe(true);
      });
    });
  });

  it('should return -1 when the value is not present', async () => {
    expect([1, 2, 3].indexOf(4)).toBe(-1);
    expect(true).toBe(true);
  });

  it('is an empty test', async () => {
  });
});
