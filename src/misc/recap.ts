function valueToStr(v: number) {
  if (v <= 10000) {
    return String(v);
  }

  if (v <= 100000000) {
    return `${Math.floor(v / 1000) / 10}만`;
  }

  if (v <= 1000000000000) {
    return `${Math.floor(v / 10000000) / 10}억`;
  }

  return null;
}

function observeAndAnimate(element: HTMLElement) {
  // 이미 애니메이션이 시작되었는지 확인하는 플래그
  let animated = false;

  // 1. Intersection Observer 객체 생성
  const observer = new IntersectionObserver((entries, observer) => {
    // entries는 관찰 대상 엘리먼트의 배열입니다. (여기서는 하나만 관찰)
    entries.forEach(entry => {
      // entry.isIntersecting: 엘리먼트가 화면 내에 있는지 여부 (boolean)
      if (entry.isIntersecting && !animated) {
        // 2. 화면에 진입했고, 아직 애니메이션이 실행되지 않았다면

        // 숫자 증가 애니메이션 함수 실행
        animateNumberIncrease(entry.target as HTMLElement);

        // 플래그를 true로 설정하여 다시 실행되지 않도록 함
        animated = true;

        // 3. 목표를 달성했으므로 더 이상 관찰할 필요가 없어 관찰을 중지
        observer.unobserve(entry.target);
      }
    });
  }, {
    // options (선택 사항):
    // root: 관찰 대상이 교차할 뷰포트 (기본값은 브라우저 뷰포트)
    // rootMargin: 뷰포트 주변의 여백 ('10px 20px 30px 40px')
    threshold: 0.1, // 4. 엘리먼트의 10%가 보일 때 교차로 인정
  });

  // 엘리먼트에 관찰을 시작하도록 지시
  observer.observe(element);
}

function handleVideoAutoplay(videoElement: HTMLVideoElement) {

  // Intersection Observer 객체 생성
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // entry.target은 관찰 중인 비디오 엘리먼트입니다.
      const video = entry.target as HTMLVideoElement;

      if (entry.isIntersecting) {
        // 1. 비디오가 화면에 진입했습니다 (재생 시작)

        // .play() 메서드는 Promise를 반환하므로 .catch()를 사용하여 오류를 처리합니다.
        // (예: 자동 재생 정책 위반 시)
        video.play().catch(error => {
          console.warn('비디오 자동 재생 실패:', error);
          // 실패 시, muted 속성을 확인하거나 사용자 상호 작용을 기다려야 합니다.
        });

      } else {
        // 2. 비디오가 화면을 벗어났습니다 (일시 정지)
        video.pause();
      }
    });
  }, {
    // 옵션 설정:
    // threshold: 0.8 -> 비디오의 80%가 화면에 보일 때 교차로 인정
    threshold: 0.3,
  });

  // 3. 비디오 엘리먼트에 대한 관찰을 시작합니다.
  observer.observe(videoElement);
}

function animateNumberIncrease(element: HTMLElement) {
  // 1. data-increase-target 속성 읽기
  const targetValue = parseInt(element.getAttribute('data-increase-target') || '0');
  const duration = parseInt(element.getAttribute('data-duration') || '1000');

  // 속성 값이 유효한 숫자인지 확인
  if (isNaN(targetValue)) {
    console.error('유효한 data-increase-target 값이 아닙니다:', element);
    return;
  }

  // 2. 애니메이션 준비
  const startTime = performance.now(); // 애니메이션 시작 시간 기록
  const startValue = 0;               // 시작 값은 0

  // 3. 애니메이션 프레임 함수 정의
  function updateCount(currentTime: number) {
    const elapsedTime = currentTime - startTime; // 경과 시간

    // 경과 시간 비율 계산 (0에서 1 사이)
    const progress = Math.min(1, elapsedTime / duration);

    // 현재 증가해야 할 값 계산 (시작값 0부터 목표값까지 비율에 따라 증가)
    const currentValue = Math.floor(startValue + progress * (targetValue - startValue));

    // 엘리먼트에 현재 값 표시
    element.textContent = valueToStr(currentValue);

    // 4. 애니메이션 지속 조건 확인
    if (progress < 1) {
      // progress가 1보다 작으면 다음 프레임 요청
      requestAnimationFrame(updateCount);
    } else {
      // 애니메이션 종료 후, 최종적으로 목표 값으로 설정 (오차 방지)
      element.textContent = valueToStr(targetValue);
    }
  }

  // 5. 애니메이션 시작
  requestAnimationFrame(updateCount);
}

function createClock(canvas: HTMLCanvasElement) {
  let elapsed = Date.now() / 1000;
  let last = Date.now();
  let start = Date.now();

  canvas.width = 400;
  canvas.height = 400;


  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;
  ctx.scale(400 / 60, 400 / 60);

  const renderHand = (len: number, radian: number) => {
    ctx.beginPath();
    ctx.rotate(radian);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -len);
    ctx.stroke();
    ctx.closePath();
    ctx.rotate(-radian);
  };

  const renderClock = () => {
    const now = Date.now();
    const delta = (now - last) / 1000;
    elapsed += delta * 100;
    last = now;

    ctx.save();
    ctx.clearRect(0, 0, 60, 60);
    ctx.translate(29.5, 29.5);

    // render outline
    ctx.beginPath();
    ctx.strokeStyle = '#00FFFF';
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.closePath();

    // render hour hand
    const hourAngle = ((elapsed % 43200) / 43200) * 360;
    const hourRadian = hourAngle / 180 * Math.PI;
    renderHand(13, hourRadian);

    // render minute hand
    const minuteAngle = ((elapsed % 3600) / 3600) * 360;
    const minuteRadian = minuteAngle / 180 * Math.PI;
    renderHand(17, minuteRadian);


    // render second hand
    ctx.strokeStyle = '#FF0000';
    const secondAngle = Math.floor(elapsed % 60) / 60 * 360;
    const secondRadian = secondAngle / 180 * Math.PI;
    renderHand(18, secondRadian);


    ctx.restore();
    requestAnimationFrame(renderClock);
  };

  renderClock();

}

function init() {
  // gsap.registerPlugin(ScrollSmoother);
  //
  // ScrollSmoother.create({
  //   smooth: 1,
  //   effects: true,
  // });
  //
  // gsap.registerPlugin(ScrollTrigger);

  const marble = document.querySelector('#main-marble') as HTMLDivElement;
  const startEl = document.querySelector('#marbleStart');
  const endEl = document.querySelector('#people-marble');


  const startRect = startEl!.getBoundingClientRect();
  const endRect = endEl!.getBoundingClientRect();

  const startX = startRect.left + startRect.width / 2 - marble.clientWidth / 2;
  const startY = startRect.top + startRect.height / 2 - marble.clientHeight / 2;

  const deltaX = (endRect.left + endRect.width / 2 - marble.clientWidth / 2) - startX;
  const deltaY = (endRect.top + endRect.height / 2 - marble.clientHeight / 2) - startY;

  gsap.set(marble, {
    x: startX,
    y: startY,
    opacity: 1,
    position: 'absolute',
  });

  const tl = gsap.timeline({
    scrollTrigger: {
      id: 'marble-timeline',
      trigger: startEl,
      start: 'top center',
      end: `+=${deltaY}`,
      scrub: true,
    },
  });

  tl.to(marble, {
    x: startX + deltaX,
    y: startY + deltaY,
    ease: 'none',
  }, 0);
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  // const increaseTargets = document.querySelectorAll('span[data-increase-target]');
  //
  // increaseTargets.forEach((target) => {
  //   observeAndAnimate(target as HTMLElement);
  // });
  //
  // const videos = document.querySelectorAll('video');
  // videos.forEach((target: HTMLVideoElement) => {
  //   handleVideoAutoplay(target);
  // });
  //
  // const sectionObserver = new IntersectionObserver((entries, observer) => {
  //   entries.forEach((entry) => {
  //     if (entry.isIntersecting) {
  //       entry.target.classList.add('active');
  //       observer.unobserve(entry.target);
  //     }
  //   });
  // }, {
  //   threshold: 0.1,
  // });
  //
  // const sections = document.querySelectorAll('section');
  // sections.forEach(section => {
  //   sectionObserver.observe(section);
  // });
  //
  // const clock = document.querySelector('#clock') as HTMLCanvasElement;
  // createClock(clock);
});
