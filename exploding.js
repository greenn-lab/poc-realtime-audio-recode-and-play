function explode(element) {
  const piecesX = 9;
  const piecesY = 4;

  const width = pxToEm(element.offsetWidth);
  const height = pxToEm(element.offsetHeight);
  const centerX = width / 2;
  const centerY = height / 2;
  const pieceWidth = width / piecesX;
  const pieceHeight = height / piecesY;

  if (!element.classList.contains('exploding')) {
    element.classList.add('exploding');

    createParticles("fire", 25, 1500);
    createParticles("debris", piecesX * piecesY, 1500);
  }

  function createParticles(kind, count, duration) {
    for (let c = 0; c < count; ++c) {
      let r = randomFloat(0.25, 0.5),
        diam = r * 2,
        xBound = centerX - r,
        yBound = centerY - r,
        easing = "cubic-bezier(0.15,0.5,0.5,0.85)";

      if (kind === "fire") {
        let x = centerX + randomFloat(-xBound, xBound),
          y = centerY + randomFloat(-yBound, yBound),
          a = calcAngle(centerX, centerY, x, y),
          dist = randomFloat(1, 5);

        new FireParticle(element, x, y, diam, diam, a, dist, duration, easing);

      }
      else if (kind === "debris") {
        let x = (pieceWidth / 2) + pieceWidth * (c % piecesX),
          y = (pieceHeight / 2) + pieceHeight * Math.floor(c / piecesX),
          a = calcAngle(centerX, centerY, x, y),
          dist = randomFloat(4, 7);

        new DebrisParticle(element, x, y, pieceWidth, pieceHeight, a, dist, duration, easing);
      }
    }
  }
}

class Particle {
  constructor(parent, x, y, w, h, angle, distance = 1, className2 = "") {
    let width = `${w}em`,
      height = `${h}em`,
      adjustedAngle = angle + Math.PI / 2;

    this.div = document.createElement("div");
    this.div.className = "particle";

    if (className2)
      this.div.classList.add(className2);

    this.div.style.width = width;
    this.div.style.height = height;

    parent.appendChild(this.div);

    this.s = {
      x: x - w / 2,
      y: y - h / 2
    };
    this.d = {
      x: this.s.x + Math.sin(adjustedAngle) * distance,
      y: this.s.y - Math.cos(adjustedAngle) * distance
    };
  }

  runSequence(el, keyframesArray, duration = 1e3, easing = "linear", delay = 0) {
    let animation = el.animate(keyframesArray, {
        duration: duration,
        easing: easing,
        delay: delay
      }
    );
    animation.onfinish = () => {
      let parentCL = el.parentElement.classList;

      el.remove();

      if (!document.querySelector(".particle"))
        parentCL.remove(...parentCL);
    };
  }
}

class DebrisParticle extends Particle {
  constructor(parent, x, y, w, h, angle, distance, duration, easing) {
    super(parent, x, y, w, h, angle, distance, "particle--debris");

    let maxAngle = 1080,
      rotX = randomInt(0, maxAngle),
      rotY = randomInt(0, maxAngle),
      rotZ = randomInt(0, maxAngle);

    this.runSequence(this.div, [
      {
        opacity: 1,
        transform: `translate(${this.s.x}em,${this.s.y}em) rotateX(0) rotateY(0) rotateZ(0)`
      },
      {
        opacity: 1,
      },
      {
        opacity: 1,
      },
      {
        opacity: 1,
      },
      {
        opacity: 0,
        transform: `translate(${this.d.x}em,${this.d.y}em) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`
      }
    ], randomInt(duration / 2, duration), easing);
  }
}

class FireParticle extends Particle {
  constructor(parent, x, y, w, h, angle, distance, duration, easing) {
    super(parent, x, y, w, h, angle, distance, "particle--fire");

    let sx = this.s.x,
      sy = this.s.y,
      dx = this.d.x,
      dy = this.d.y;

    this.runSequence(this.div, [
      {
        background: "hsl(60,100%,100%)",
        transform: `translate(${sx}em,${sy}em) scale(1)`
      },
      {
        background: "hsl(60,100%,80%)",
        transform: `translate(${sx + (dx - sx) * 0.25}em,${sy + (dy - sy) * 0.25}em) scale(4)`
      },
      {
        background: "hsl(40,100%,60%)",
        transform: `translate(${sx + (dx - sx) * 0.5}em,${sy + (dy - sy) * 0.5}em) scale(7)`
      },
      {
        background: "hsl(20,100%,40%)"
      },
      {
        background: "hsl(0,0%,20%)",
        transform: `translate(${dx}em,${dy}em) scale(0)`
      }
    ], randomInt(duration / 2, duration), easing);
  }
}

function calcAngle(x1, y1, x2, y2) {
  let opposite = y2 - y1,
    adjacent = x2 - x1,
    angle = Math.atan(opposite / adjacent);

  if (adjacent < 0)
    angle += Math.PI;

  if (isNaN(angle))
    angle = 0;

  return angle;
}

function propertyUnitsStripped(el, property, unit) {
  const cs = window.getComputedStyle(el);
  const valueRaw = cs.getPropertyValue(property);
  return valueRaw.substring(0, valueRaw.indexOf(unit));
}

function pxToEm(px) {
  const el = document.querySelector(":root");
  return px / propertyUnitsStripped(el, "font-size", "px");
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.round(Math.random() * (max - min)) + min;
}
