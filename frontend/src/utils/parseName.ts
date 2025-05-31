export const parseName = (nameStr: string) => {
  const weightRegex = /(\/\d+)/;
  const countRegex = /(\*\d+)/;
  const nameMatch = /^\s*([^\/*]+)?/.exec(nameStr);
  const name = nameMatch ? nameMatch[1] : '';
  const weight = weightRegex.test(nameStr) ? parseInt(weightRegex.exec(nameStr)![1].replace('/', '')) : 1;
  const count = countRegex.test(nameStr) ? parseInt(countRegex.exec(nameStr)![1].replace('*', '')) : 1;
  return { name, weight, count };
};
