
(() => {
  const $ = id => document.getElementById(id);

  const leaderboardPanel = $("home-leaderboard-panel");
  const settingsPanel = $("home-settings-panel");

  const leaderboardButton = $("home-leaderboard-button");
  const settingsButton = $("home-settings-button");

  function closeHomePanels() {
    leaderboardPanel.hidden = true;
    settingsPanel.hidden = true;
  }

  leaderboardButton.addEventListener("click", () => {
    const shouldOpen = leaderboardPanel.hidden;

    closeHomePanels();

    if (shouldOpen) {
      leaderboardPanel.hidden = false;

      requestAnimationFrame(() => {
        leaderboardPanel.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      });
    }
  });

  settingsButton.addEventListener("click", () => {
    const shouldOpen = settingsPanel.hidden;

    closeHomePanels();

    if (shouldOpen) {
      settingsPanel.hidden = false;

      requestAnimationFrame(() => {
        settingsPanel.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      });
    }
  });

  $("close-settings-button").addEventListener("click", () => {
    settingsPanel.hidden = true;
  });

  $("close-leaderboard-button").addEventListener("click", () => {
    leaderboardPanel.hidden = true;
  });



  const homeMusic = $("home-music-volume");
  const homeEffects = $("home-effects-volume");

  const gameMusic = $("music-volume");
  const gameEffects = $("effects-volume");

  homeMusic.addEventListener("input", () => {
    gameMusic.value = homeMusic.value;

    gameMusic.dispatchEvent(
      new Event("input", { bubbles: true })
    );
  });

  homeEffects.addEventListener("input", () => {
    gameEffects.value = homeEffects.value;

    gameEffects.dispatchEvent(
      new Event("input", { bubbles: true })
    );
  });



  gameMusic.addEventListener("input", () => {
    homeMusic.value = gameMusic.value;
  });

  gameEffects.addEventListener("input", () => {
    homeEffects.value = gameEffects.value;
  });

 

  const homeMuteButton = $("home-mute-button");
  const gameMuteButton = $("mute-button");

  function updateMuteLabels() {
    const muted = gameMuteButton.textContent.trim() === "UNMUTE";

    homeMuteButton.textContent = muted
      ? "UNMUTE ALL"
      : "MUTE ALL";
  }

  homeMuteButton.addEventListener("click", () => {
    if (typeof window.toggleMute === "function") {
      window.toggleMute();
      updateMuteLabels();
    }
  });

  gameMuteButton.addEventListener("click", () => {
    updateMuteLabels();
  });


  const characterCanvas = $("home-character");
  const characterContext = characterCanvas.getContext("2d");

  let characterFrame = 0;

  function drawHomeBoy() {
    const ctx = characterContext;

    ctx.clearRect(
      0,
      0,
      characterCanvas.width,
      characterCanvas.height
    );

    const x = 31;
    const y = 24;

    const blinking = characterFrame % 230 >= 218;

  
    ctx.fillStyle = "#70458f";
    ctx.fillRect(x - 5, y + 24, 10, 17);

    ctx.fillStyle = "#bd83c9";
    ctx.fillRect(x - 4, y + 27, 7, 8);

    ctx.fillStyle = "#49302b";
    ctx.fillRect(x + 5, y + 1, 25, 9);
    ctx.fillRect(x + 3, y + 7, 7, 8);
    ctx.fillRect(x + 23, y + 5, 8, 5);

    ctx.fillStyle = "#f2bd8d";
    ctx.fillRect(x + 7, y + 9, 22, 16);

  
    ctx.fillStyle = "#49302b";
    ctx.fillRect(x + 7, y + 8, 8, 4);
    ctx.fillRect(x + 19, y + 8, 8, 3);

    
    ctx.fillStyle = "#382b3b";

    if (blinking) {
      ctx.fillRect(x + 13, y + 16, 3, 1);
      ctx.fillRect(x + 23, y + 16, 3, 1);
    } else {
      ctx.fillRect(x + 13, y + 15, 2, 3);
      ctx.fillRect(x + 23, y + 15, 2, 3);
    }

    ctx.fillStyle = "#a65d68";
    ctx.fillRect(x + 17, y + 20, 2, 1);
    ctx.fillRect(x + 18, y + 21, 5, 1);
    ctx.fillRect(x + 23, y + 20, 2, 1);

    ctx.fillStyle = "#7952a5";
    ctx.fillRect(x + 5, y + 25, 26, 17);

    ctx.fillStyle = "#b99ad8";
    ctx.fillRect(x + 17, y + 27, 2, 12);

   
    ctx.fillStyle = "#e99bc9";
    ctx.fillRect(x + 5, y + 23, 25, 5);
    ctx.fillRect(x + 25, y + 26, 5, 9);

   
    ctx.fillStyle = "#f2bd8d";
    ctx.fillRect(x + 1, y + 29, 5, 9);
    ctx.fillRect(x + 30, y + 29, 5, 9);

    
    ctx.fillStyle = "#39466e";
    ctx.fillRect(x + 7, y + 41, 8, 7);
    ctx.fillRect(x + 21, y + 41, 8, 7);

    ctx.fillStyle = "#f3d58d";
    ctx.fillRect(x + 4, y + 46, 12, 3);
    ctx.fillRect(x + 19, y + 46, 12, 3);

    characterFrame++;
  }

  function animateHomeBoy() {
    drawHomeBoy();
    requestAnimationFrame(animateHomeBoy);
  }

  animateHomeBoy();



  homeMusic.value = gameMusic.value;
  homeEffects.value = gameEffects.value;

  updateMuteLabels();

})();


const starboundMusicVariations = [
  [392, 494, 587, 494, 440, 523, 659, 523, 349, 440, 523, 440, 392, 494, 587, 659],
  [523, 659, 784, 659, 587, 698, 880, 698, 440, 523, 659, 523, 392, 494, 587, 523],
  [349, 440, 523, 659, 587, 523, 440, 392, 349, 392, 440, 523, 494, 440, 392, 349],
  [440, 523, 659, 587, 523, 659, 784, 659, 494, 587, 698, 587, 440, 523, 587, 659]
];

let starboundCurrentVariation = -1;
let starboundActiveMelody = starboundMusicVariations[0];

const originalStarboundStart = window.startGame;

window.startGame = function (...args) {
  let nextVariation;

  do {
    nextVariation = Math.floor(
      Math.random() * starboundMusicVariations.length
    );
  } while (
    starboundMusicVariations.length > 1 &&
    nextVariation === starboundCurrentVariation
  );

  starboundCurrentVariation = nextVariation;
  starboundActiveMelody = starboundMusicVariations[nextVariation];

  return originalStarboundStart.apply(this, args);
};


window.musicNote = function () {
  const ac = ensureAudio();

  if (!ac || muted || musicVolume <= 0 || paused || !running) return;

  const oscillator = ac.createOscillator();
  const gain = ac.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.value =
    starboundActiveMelody[musicStep % starboundActiveMelody.length];

  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.linearRampToValueAtTime(
    0.025 * musicVolume,
    ac.currentTime + 0.04
  );
  gain.gain.linearRampToValueAtTime(
    0.0001,
    ac.currentTime + 0.42
  );

  oscillator.connect(gain);
  gain.connect(ac.destination);

  oscillator.start();
  oscillator.stop(ac.currentTime + 0.44);

  musicStep++;
};


const originalStarboundSfx = window.sfx;

window.sfx = function (kind) {
  if (
    kind === "hit" &&
    typeof running !== "undefined" &&
    !running
  ) {
    tone(784, 0.22, "sine", 0.035, 0);
    tone(659, 0.25, "sine", 0.035, 0.16);
    tone(523, 0.3, "sine", 0.03, 0.34);
    tone(392, 0.4, "sine", 0.025, 0.55);
    return;
  }

  return originalStarboundSfx.apply(this, arguments);
};
