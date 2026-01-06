import './localization';
import { Roulette } from './roulette';
import options from './options';
import { registerServiceWorker } from './registerServiceWorker';


registerServiceWorker();

const roulette = new Roulette();

// eslint-disable-next-line
(window as any).roulette = roulette;
// eslint-disable-next-line
(window as any).options = options;
