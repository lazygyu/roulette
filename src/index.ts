import './localization';
import { Roulette } from './roulette';
import options from './options';

const roulette = new Roulette();

// eslint-disable-next-line
(window as any).roullete = roulette;
// eslint-disable-next-line
(window as any).options = options;
