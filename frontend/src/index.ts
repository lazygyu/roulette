import './localization';
import { Roulette } from './roulette';
import options from './options';
import socketService from './socketService'; // Import the socket service instance

const roulette = new Roulette();

// Expose roulette instance and options globally for existing inline scripts
// eslint-disable-next-line
(window as any).roullete = roulette;
// eslint-disable-next-line
(window as any).options = options;

// Expose socketService globally so inline scripts in index.html can use it
// eslint-disable-next-line
(window as any).socketService = socketService;

// Expose updateMapSelector function globally (defined in index.html inline script)
// This is a workaround; ideally, UI updates should be handled within TypeScript modules.
declare global {
    interface Window {
        updateMapSelector: (maps: { index: number; title: string }[]) => void;
        socketService: typeof socketService; // Add type definition for socketService
        roullete: Roulette; // Add type definition for roullete
        options: typeof options; // Add type definition for options
        translateElement: (element: HTMLElement) => void; // Assuming this exists globally
        dataLayer: any[]; // For gtag
        gtag: (...args: any[]) => void; // For gtag
    }
}
