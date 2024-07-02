import './localization';
import {Roulette} from './roulette';
import options from './options';

const roulette = new Roulette();
(window as any).roullete = roulette;
(window as any).options = options;
