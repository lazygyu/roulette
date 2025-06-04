export function rad(degree: number) {
  return (Math.PI * degree) / 180;
}

export function pad(v: number) {
  return v.toString().padStart(2, '0');
}
