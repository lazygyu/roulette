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

function once(el: EventTarget, event: string, fn: Function, opts?: any) {
  const onceFn = function() {
    el.removeEventListener(event, onceFn);
    // @ts-ignore
    fn.apply(this, arguments);
  };
  el.addEventListener(event, onceFn, opts);
  return onceFn;
}

const loadVideo = (video: HTMLVideoElement, tl?: GSAPTimeline) => {
  let src = video.currentSrc || video.src;

  if (tl) {
    once(document.documentElement, 'touchstart', function() {
      video.play();
      console.log('pause by normal touch');
      video.pause();
    });
  }

  once(video, 'loadedmetadata', () => {
    console.log(`${video.src} has loaded`);
    if (tl) {
      tl.fromTo(video, {
        currentTime: 0,
      }, {
        currentTime: video.duration || 1,
        duration: 1000,
      }, 0);
    } else {
      video.play();
    }
  });

  setTimeout(() => {
    fetch(src)
      .then((res) => res.blob())
      .then((res) => {
        const blobUrl = URL.createObjectURL(res);
        const t = video.currentTime;
        if (tl) {
          once(document.documentElement, 'touchstart', () => {
            video.play();
            console.log('pause by load touch');
            video.pause();
          });
        }

        video.setAttribute('src', blobUrl);
        video.currentTime = t + 0.01;
      });
  }, 1000);

};


const titlePage = () => {
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

  const tl = gsap.timeline(/*{
    scrollTrigger: {
      trigger: titlePage,
      start: 'top top',
      end: '+=1000',
      scrub: true,
    },
  }*/);


  const square = document.querySelector('.square')!;


  tl.fromTo(marble, {
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
    duration: 500,
    ease: 'back.in',
  }, 0)
    .to(marble, {
      scale: 3,
      duration: 500,
    }, '<')
    .to('div.square', { rotate: -45 * 3, ease: 'bounce.out', duration: 200 }, '>')
    .to(marble, {
      x: () => {
        const squareRect = square.getBoundingClientRect();
        return squareRect.left - 80;
      },
      duration: 500,
    }, '<')
    .to(marble, {
      y: innerHeight,
      ease: 'back.in',
      opacity: 0,
      duration: 500,
    }, '<');
  return tl;
};


const peoplePage = () => {
  const pPage = document.querySelector('#people-page') as HTMLDivElement;
  const video = document.querySelector('video#people-video') as HTMLVideoElement;

  const tl = gsap.timeline();


  loadVideo(video, tl);


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
    }, 0)
    .to(numbersAppear, {
      peopleCountProgress: 1,
      duration: 200,
      onUpdate: () => {
        peopleCountValue.innerHTML = comma(Math.round(numbersAppear.peopleCountProgress * data.people));
      },
    }, '<')
    .to(peopleCount, {
      delay: 100,
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

  return tl;
};

const executionPage = () => {
  const ePage = document.querySelector('#execution-page') as HTMLDivElement;
  const video = document.querySelector('video#execution-video') as HTMLVideoElement;
  const startCountValue = ePage.querySelector('[data-prop="startCount"]') as HTMLElement;

  let src = video.currentSrc || video.src;

  const tl = gsap.timeline();

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


  tl
    .to(numbersAppear, {
      duration: 200,
      startCountProgress: 1,
      onUpdate: () => {
        startCountValue.innerHTML = comma(Math.round(numbersAppear.startCountProgress * data.startCount));
      },
    }, 0)
    .to(ePage, {
      autoAlpha: 0,
      duration: 100,
    }, '>+200');

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
  return tl;
};

const dateTimePage = () => {
  const dPage = document.querySelector('#date-hours-page') as HTMLDivElement;

  const hours = document.querySelector('#hour-content') as HTMLDivElement;
  const dates = document.querySelector('#date-content') as HTMLDivElement;

  const hoursFromValue = hours.querySelector('[data-prop="busiestTimeFrom"]') as HTMLElement;
  const hoursToValue = hours.querySelector('[data-prop="busiestTimeTo"]') as HTMLElement;

  const monthValue = dates.querySelector('[data-prop="busiestDateMonth"]') as HTMLElement;
  const dateValue = dates.querySelector('[data-prop="busiestDateDate"]') as HTMLElement;

  const tl = gsap.timeline();
  const numbersProgress = {
    hoursProgress: 0,
    datesProgress: 0,
  };
  tl.fromTo(numbersProgress, {
    hoursProgress: 0,
  }, {
    hoursProgress: 1,
    duration: 200,
    onUpdate: () => {
      hoursFromValue.innerHTML = String(Math.floor(data.busiestTimeFrom * numbersProgress.hoursProgress));
      hoursToValue.innerHTML = String(Math.floor(data.busiestTimeTo * numbersProgress.hoursProgress));
    },
  }, 0);
  tl.fromTo(hours, {
    autoAlpha: 0,
    y: '+=1rem',
  }, {
    autoAlpha: 1,
    y: '-=2rem',
    duration: 100,
  }, 0)
    .to(hours, {
      delay: 100,
      y: '-=1rem',
      autoAlpha: 0,
      duration: 100,
    })
    .fromTo(dates, {
      autoAlpha: 0,
      y: '+=1rem',
    }, {
      duration: 100,
      autoAlpha: 1,
      y: '-=2rem',
    }, '<+50')
    .fromTo(numbersProgress, {
      datesProgress: 0,
    }, {
      datesProgress: 1,
      duration: 100,
      ease: 'power3.out',
      onUpdate: () => {
        monthValue.innerHTML = String(Math.floor(numbersProgress.datesProgress * data.busiestDateMonth));
        dateValue.innerHTML = String(Math.floor(numbersProgress.datesProgress * data.busiestDateDate));
      },
    }, '<');

  tl.fromTo(dPage.querySelector('div.hour.hand'), {
    transformOrigin: 'center bottom',
    rotation: 0,
  }, {
    rotation: 360 + 30,
    duration: 1000,
  }, 0)
    .fromTo(dPage.querySelector('div.hand.minute'), {
      transformOrigin: 'center bottom',
      rotation: 0,
    }, {
      rotation: 360 * 10,
      duration: 1000,
    }, '<')
    .fromTo(dPage, { autoAlpha: 1 }, { autoAlpha: 0, duration: 100 }, '>+100');

  return tl;
};

const marbleCountPage = () => {
  const mPage = document.querySelector('#marble-count-page') as HTMLDivElement;

  const marbleCount = mPage.querySelector('[data-prop="marbleCount"]') as HTMLElement;
  const pyramidCount = mPage.querySelector('[data-prop="pyramidCount"]') as HTMLElement;
  const pyramids = mPage.querySelector('.pyramids') as HTMLDivElement;

  const numbersProgress = {
    progress: 0,
  };

  const tl = gsap.timeline();

  tl.fromTo(numbersProgress, {
    progress: 0,
  }, {
    progress: 1,
    duration: 2800,
    onUpdate: () => {
      const count = Math.round(numbersProgress.progress * data.pyramidCount);
      marbleCount.innerHTML = comma(Math.floor(numbersProgress.progress * data.marbleCount));
      pyramidCount.innerHTML = String(count);
      for (let i = 0; i < data.pyramidCount; i++) {
        (pyramids.children[i] as HTMLElement).style.display = i < count ? 'block' : 'none';
      }
    },
  }, 0)
    .fromTo(mPage.querySelector('div.content'), {
      autoAlpha: 0,
      y: '+=1rem',
    }, {
      autoAlpha: 1,
      duration: 100,
      y: '-=1rem',
    }, 0)
    .to(mPage.querySelector('div.content'), {
      autoAlpha: 0,
      y: '-=1rem',
      duration: 100,
    }, '>+3000')
    .to(pyramids, {
      autoAlpha: 0,
      scale: 10,
      duration: 500,
    }, '<')
    .fromTo(mPage, {
      autoAlpha: 1,
    }, {
      autoAlpha: 0,
      duration: 100,
    }, '>-100');
  return tl;
};

const coffeePage = () => {
  const cPage = document.querySelector('section#coffee-page') as HTMLDivElement;
  const img = cPage.querySelector('img') as HTMLDivElement;
  const content = cPage.querySelector('div.content') as HTMLDivElement;
  const coffeeCountValue = content.querySelector('[data-prop=coffeeBuyer]')!;

  const numbersProgress = {
    progress: 0,
  };

  const tl = gsap.timeline()
    .fromTo(numbersProgress, { progress: 0 }, {
      progress: 1,
      duration: 200,
      onUpdate: () => {
        coffeeCountValue.innerHTML = String(Math.round(numbersProgress.progress * data.coffeeBuyer));
      },
    }, 0).to(numbersProgress, { progress: 1, duration: 800 });

  tl.fromTo(img, {
    y: '+=2rem',
  }, {
    y: '-=5rem',
    ease: 'elastic.out',
    duration: 100,
  }, 0)
    .fromTo(img, {
      autoAlpha: 0,
    }, {
      autoAlpha: 1,
      duration: 200,
    }, '<')
    .fromTo(cPage, {
      autoAlpha: 1,
    }, {
      autoAlpha: 0,
      duration: 100,
    });
  return tl;
};

const thanksPage = () => {
  return null;
};

const init = () => {
  setNumbers();

  gsap.registerPlugin(ScrollTrigger);
  gsap.registerPlugin(ScrollSmoother);

  ScrollSmoother.create({
    smooth: 1,
    effects: true,
    smoothTouch: 0.1,
  });

  // ScrollTrigger.normalizeScroll(true);
  const sections = gsap.utils.toArray<HTMLElement>('section');
  gsap.set(sections[0], { autoAlpha: 1 });

  const getTimeline = (section: HTMLElement) => {
    switch (section.id) {
      case 'title-page':
        return titlePage();
      case 'people-page':
        return peoplePage();
      case 'execution-page':
        return executionPage();
      case 'date-hours-page':
        return dateTimePage();
      case 'marble-count-page':
        return marbleCountPage();
      case 'coffee-page':
        return coffeePage();
      case 'thanks-page':
        return thanksPage();
    }
    return null;
  };

  sections.forEach((section, i, arr) => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom top',
        pin: i !== arr.length - 1,
        pinSpacing: false,
        scrub: true,
        onEnter: () => gsap.to(section, { autoAlpha: 1, duration: .35 }),
        onLeaveBack: () => i && gsap.to(section, { autoAlpha: 0, duration: .35 }),
        // onLeave: () => gsap.to(section, { yPercent: -100, duration: 0.35 }),
      },
    });
    const child = getTimeline(section);
    if (child) {
      tl.add(child, 0);
    }
  });

  document.querySelector('#statDate')!.innerHTML = data.date;
};

document.addEventListener('DOMContentLoaded', init);
