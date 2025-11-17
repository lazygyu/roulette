export function rad(degree: number) {
  return (Math.PI * degree) / 180;
}

function getRegexValue(regex: RegExp, str: string) {
  const result = regex.exec(str);
  return result ? result[1] : '';
}

export function parseName(nameStr: string) {
  const weightRegex = /\/(\d+)/;
  const countRegex = /\*(\d+)/;
  const hasWeight = weightRegex.test(nameStr);
  const hasCount = countRegex.test(nameStr);
  const name = getRegexValue(/^\s*([^\/*]+)?/, nameStr);
  if (!name) return null;
  const weight = hasWeight ? parseInt(getRegexValue(weightRegex, nameStr)) : 1;
  const count = hasCount ? parseInt(getRegexValue(countRegex, nameStr)) : 1;
  return {
    name,
    weight,
    count,
  };
}

export function pad(v: number) {
  return v.toString().padStart(2, '0');
}

export function shuffle<T>(originalArray: T[]): T[] {
    const array = originalArray.slice();
  let currentIndex = array.length;
  let randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}