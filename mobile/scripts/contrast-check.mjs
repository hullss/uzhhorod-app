const pairs = [
  ["Світла: основний текст", "#596574", "#ffffff"],
  ["Світла: metadata", "#66758a", "#ffffff"],
  ["Світла: заголовок", "#102d49", "#f6f7fb"],
  ["Світла: основна дія", "#123a63", "#ffffff"],
  ["Світла: попередження", "#624600", "#fff8e9"],
  ["Світла: помилка", "#991b1b", "#fff5f4"],
  ["Темна: основний текст", "#b8cbe0", "#102d49"],
  ["Темна: metadata", "#91a9bf", "#102d49"],
  ["Темна: заголовок у картці", "#f3f7fc", "#102d49"],
  ["Темна: основна дія", "#ffffff", "#174b75"],
  ["Темна: попередження", "#f4d47a", "#332b22"],
  ["Темна: помилка", "#ffb4ad", "#332b22"],
  ["Темна: маршрут", "#ffffff", "#174b75"],
  ["Темна: border контролу", "#7399b9", "#102d49"],
];

function luminance(hex) {
  const values = hex.slice(1).match(/.{2}/g).map((value) => Number.parseInt(value, 16) / 255);
  const [r, g, b] = values.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

let failed = false;
for (const [label, foreground, background] of pairs) {
  const value = ratio(foreground, background);
  const passes = value >= 4.5;
  console.log(`${passes ? "PASS" : "FAIL"}  ${value.toFixed(2)}:1  ${label}`);
  failed ||= !passes;
}

if (failed) process.exitCode = 1;
