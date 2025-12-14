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
      elem.setAttribute('data-target', String(value));
    }
  });

};

function comma(v: number): string {
  return v.toLocaleString('en-US');
}


const titlePage = () => {
  const titlePage = document.querySelector('#title-page')!;
  const marble = document.querySelector('div#main-marble')!;
  const startPoint = document.querySelector('#marble-start')!;
  const startPointRect = startPoint.getBoundingClientRect();


  window.addEventListener('resize', () => {
    console.log('resize!');
    requestAnimationFrame(() => {
      console.log('check!');
      const startPointRect = startPoint.getBoundingClientRect();
      gsap.from(marble, {
        x: startPointRect.x + startPointRect.width / 2 - 12,
        y: startPointRect.y + startPointRect.height / 2 - 9,
        opacity: 1,
      });
    });
  });

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
      pinSpacing: true,
    },
  });


  const square = document.querySelector('.square')!;


  tl1.fromTo(marble, {
    x: () => {
      const startPointRect = startPoint.getBoundingClientRect();
      return startPointRect.x + startPointRect.width / 2 - 12;
    },
    y: () => {
      const startPointRect = startPoint.getBoundingClientRect();
      return startPointRect.y + startPointRect.height / 2 - 9;
    },
    opacity: 1,
  }, {
    y: () => {
      const squareRect = square.getBoundingClientRect();
      return squareRect.top - 50;
    },
    x: () => {
      const squareRect = square.getBoundingClientRect();
      return squareRect.left + 10;
    },
    duration: 10,
    ease: 'back.in',
  }, 0)
    .to(marble, {
      scale: 3,
      duration: 10,
    }, '<')
    .to('div.square', { rotate: -45 * 3, ease: 'bounce.out', duration: 10 }, '>')
    .to(marble, {
      x: () => {
        const squareRect = square.getBoundingClientRect();
        return squareRect.left - 80;
      },
      duration: 10,
    }, '<')
    .to(marble, {
      y: innerHeight,
      ease: 'back.in',
      opacity: 0,
      duration: 10,
    }, '<');
};

function once(el: EventTarget, event: string, fn: Function, opts?: any) {
  const onceFn = function() {
    el.removeEventListener(event, onceFn);
    // @ts-ignore
    fn.apply(this, arguments);
  };
  el.addEventListener(event, onceFn, opts);
  return onceFn;
}

const peoplePage = () => {
  const pPage = document.querySelector('#people-page') as HTMLDivElement;
  const video = document.querySelector('video#people-video') as HTMLVideoElement;
  let src = video.currentSrc || video.src;

  gsap.set(pPage, { y: '-=80vh' });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#people-page',
      start: 'top top',
      end: '+=1200',
      scrub: true,
      pin: true,
      pinSpacing: true,
      onEnter: () => {
        console.log('entered people');
      },
    },
  });

  once(document.documentElement, 'touchstart', function() {
    video.play();
    video.pause();
  });

  once(video, 'loadedmetadata', () => {
    tl.fromTo(video, {
      currentTime: 0,
    }, {
      currentTime: video.duration || 1,
      duration: 1000,
    }, 0);
  });

  const peopleCount = pPage.querySelector('.people-count') as HTMLElement;
  const countryCount = pPage.querySelector('.country-count') as HTMLElement;

  const peopleCountValue = peopleCount.querySelector('[data-prop="people"]')!;
  const countryCountValue = countryCount.querySelector('[data-prop="country"]')!;
  const numbersAppear = {
    peopleCountProgress: 0,
    countryCountProgress: 0,
  };

  tl
    .fromTo(peopleCount, {
      opacity: 0,
    }, {
      duration: 100,
      opacity: 1,
      progress: 0,
    }, 0)
    .to(numbersAppear, {
      peopleCountProgress: 1,
      duration: 300,
      onUpdate: () => {
        peopleCountValue.innerHTML = comma(Math.round(numbersAppear.peopleCountProgress * data.people));
      },
    }, '<')
    .to(peopleCount, {
      duration: 400,
      ease: 'power4.in',
      y: '-=30',
      opacity: 0,
    }, '>')
    .fromTo(countryCount, {
      opacity: 0,
    }, {
      duration: 500,
      ease: 'power4.out',
      opacity: 1,
    }, '>-200')
    .to(numbersAppear, {
      countryCountProgress: 1,
      duration: 200,
      onUpdate: () => {
        countryCountValue.innerHTML = comma(Math.round(numbersAppear.countryCountProgress * data.country));
      },
    }, '<')
    .to(pPage, {
      delay: 900,
      autoAlpha: 0,
      duration: 100,
    }, 0);

  setTimeout(() => {
    fetch(src)
      .then((res) => res.blob())
      .then((res) => {
        const blobUrl = URL.createObjectURL(res);
        const t = video.currentTime;
        once(document.documentElement, 'touchstart', () => {
          video.play();
          video.pause();
        });

        video.setAttribute('src', blobUrl);
        video.currentTime = t + 0.01;
      });
  }, 1000);


};

const executionPage = () => {
  const ePage = document.querySelector('#execution-page') as HTMLDivElement;
  const video = document.querySelector('video#execution-video') as HTMLVideoElement;
  const content = ePage.querySelector('div.text') as HTMLDivElement;
  const startCountValue = ePage.querySelector('[data-prop="startCount"]') as HTMLElement;

  let src = video.currentSrc || video.src;

  gsap.set(ePage, { y: '-=190vh' });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: ePage,
      start: 'top top',
      end: '+=1000',
      scrub: true,
      pin: true,
      pinSpacing: true,
    },
  });

  once(document.documentElement, 'touchstart', function() {
    video.play();
    video.pause();
  });

  once(video, 'loadedmetadata', () => {
    tl.fromTo(video, {
      currentTime: 0,
    }, {
      currentTime: video.duration || 1,
      duration: 500,
    }, 0);
  });

  const numbersAppear = {
    startCountProgress: 0,
  };


  tl.fromTo(content, {
    autoAlpha: 0,
  }, {
    autoAlpha: 1,
    duration: 100,
  }, 0)
    .to(numbersAppear, {
      duration: 300,
      startCountProgress: 1,
      onUpdate: () => {
        startCountValue.innerHTML = comma(Math.round(numbersAppear.startCountProgress * data.startCount));
      },
    }, '<')
      .to(ePage, {
        autoAlpha: 0,
        duration: 100,
      }, '>+100');

  setTimeout(() => {
    fetch(src)
      .then((res) => res.blob())
      .then((res) => {
        const blobUrl = URL.createObjectURL(res);
        const t = video.currentTime;
        once(document.documentElement, 'touchstart', () => {
          video.play();
          video.pause();
        });

        video.setAttribute('src', blobUrl);
        video.currentTime = t + 0.01;
      });
  }, 1000);
};

const dateTimePage = () => {
  const dPage = document.querySelector('#date-hours-page') as HTMLDivElement;

  const hours = document.querySelector('#hour-content') as HTMLDivElement;
  const dates = document.querySelector('#date-content') as HTMLDivElement;

  gsap.set(dPage, { y: '-=300vh' });
  const tl = gsap.timeline({
    scrollTrigger: {
      markers: { startColor: 'green', endColor: 'red', fontSize: '12px' },
      trigger: dPage,
      start: 'top top',
      end: '+=1000',
      scrub: true,
      pin: true,
    }
  });
  tl.fromTo(hours, {
    autoAlpha: 0,
    y: '+=1rem'
  }, {
    autoAlpha: 1,
    y: '-=1rem',
    duration: 100,
  }, 0)
      .to(hours, {
        delay: 300,
        y: '-=1rem',
        autoAlpha: 0,
        duration: 100,
      })
      .fromTo(dates, {
        autoAlpha: 0,
        y: '+=1rem'
      }, {
        duration: 100,
        autoAlpha: 1,
        y: '-=1rem',
      }, '<+50');

  tl.fromTo(hours.querySelector('div.hour.hand'), {
    rotation: 0,
  }, {
    rotation: 360 + 30,
    duration: 500,
  }, 0)
      .fromTo(hours.querySelector('div.hand.minute'), {
        rotation: 0,
      }, {
        rotation: 360 * 10,
        duration: 500,
      }, '<')
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

  // ScrollTrigger.normalizeScroll(true);


  titlePage();
  peoplePage();
  executionPage();
  dateTimePage();

};

document.addEventListener('DOMContentLoaded', init);
