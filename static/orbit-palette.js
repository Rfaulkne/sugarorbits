/* Visual interpolation only: never used for glucose calculations. */
(function (root) {
  const stops = [
    [2.2, [65, 96, 255]], [3.9, [78, 193, 255]],
    [6.4, [207, 199, 225]], [10, [205, 128, 218]],
    [13, [255, 107, 125]], [18, [255, 144, 65]]
  ];
  function color(value) {
    if (!Number.isFinite(value)) return 'rgb(207,199,225)';
    if (value <= stops[0][0]) return `rgb(${stops[0][1]})`;
    for (let i = 1; i < stops.length; i++) {
      const [upper, end] = stops[i];
      const [lower, start] = stops[i - 1];
      if (value <= upper) {
        const t = (value - lower) / (upper - lower);
        return `rgb(${start.map((v, j) => Math.round(v + (end[j] - v) * t))})`;
      }
    }
    return `rgb(${stops[stops.length - 1][1]})`;
  }
  const palette = { color };
  if (typeof module !== 'undefined') module.exports = palette;
  else root.SugarOrbitPalette = palette;
})(typeof window !== 'undefined' ? window : globalThis);
