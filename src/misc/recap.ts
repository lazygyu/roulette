import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { data } from './recap-2025-data';

const setNumbers = () => {
  const targets = document.querySelectorAll('[data-prop]');

  targets.forEach((elem) => {
    const key = elem.getAttribute('data-prop');
    if (key && data.hasOwnProperty(key)) {
      const value = data[key as keyof typeof data];
      elem.innerHTML = String(value);
    }
  });

};

const titlePage = () => {
  const titlePage = document.querySelector('#title-page')!;
  const marble = document.querySelector('div#main-marble')!;
  const startPoint = document.querySelector('#marble-start')!;
  const startPointRect = startPoint.getBoundingClientRect();
  gsap.set(marble, {
    x: startPointRect.x + startPointRect.width / 2 - 12,
    y: startPointRect.y + startPointRect.height / 2 - 9,
    opacity: 1,
  });

  gsap.set('div.square', { rotate: 0 });
  const tl1 = gsap.timeline({
    scrollTrigger: {
      trigger: titlePage,
      start: 'top top',
      endTrigger: '#people-page',
      end: 'top top',
      scrub: true,
      pin: true,
      pinSpacing: false,
    },
  });


  const square = document.querySelector('.square')!;
  const squareRect = square.getBoundingClientRect();


  tl1.to(marble, {
    y: squareRect.top - 20,
    x: squareRect.left + 10,
    duration: 10,
    ease: 'back.in',
  }, 0)
    .to('div.square', { rotate: -45 * 3, ease: 'bounce.out', duration: 10 }, '>')
    .to(marble, {
      x: squareRect.left - 80,
      duration: 10,
    }, '<')
    .to(marble, {
      y: innerHeight,
      ease: 'back.in',
      opacity: 0,
      duration: 10,
    }, '<');
};

const peoplePage = () => {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#people-page',
      start: 'top top',
      end: 'bottom top',
      pin: true,
      pinSpacing: true,
      scrub: true,
    },
  });
};

const init = () => {
  setNumbers();

  gsap.registerPlugin(ScrollSmoother);
  gsap.registerPlugin(ScrollTrigger);

  ScrollSmoother.create({
    smooth: 1,
    effects: true,
    smoothTouch: 0.1,
  });


  titlePage();
  peoplePage();

};

document.addEventListener('DOMContentLoaded', init);
