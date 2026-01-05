import './localization';
import { Roulette } from './roulette';
import options from './options';
import { registerServiceWorker } from './registerServiceWorker';
import { TeamDicider } from './teamDicider';


registerServiceWorker();

const roulette = new Roulette();
const teamDicider = new TeamDicider();

// eslint-disable-next-line
(window as any).roulette = roulette;
// eslint-disable-next-line
(window as any).options = options;
(window as any).teamDicider = teamDicider;
