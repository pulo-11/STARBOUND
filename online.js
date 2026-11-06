

const SUPABASE_URL = "https://haiazrlwbqcoqpkuzkuj.supabase.co";
const SUPABASE_KEY = "sb_publishable_Id-WaTZkVGmW3VA1LsVyTA_LlmyjH7h";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let onlineUser = null;
let onlineName = localStorage.getItem("starbound-display-name") || "";

const PAGE_SIZE = 50;
let leaderboardOffset = 0;
let leaderboardSearch = "";
let leaderboardHasMore = false;
let leaderboardLoading = false;



const nameInput = document.getElementById("player-name");
const nameStatus = document.getElementById("name-status");
const saveNameButton = document.getElementById("save-player-name");

const leaderboardList = document.getElementById("online-leaderboard-list");
const leaderboardInfo = document.getElementById("online-player-info");
const leaderboardStatus = document.getElementById("leaderboard-status");
const loadMoreButton = document.getElementById("leaderboard-load-more");
const searchInput = document.getElementById("leaderboard-search");
const searchButton = document.getElementById("leaderboard-search-button");

nameInput.value = onlineName;



async function initialiseOnlinePlayer() {
  try {
    nameStatus.textContent = "Connecting to STARBOUND...";

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    let session = data.session;

    if (!session) {
      const result = await supabaseClient.auth.signInAnonymously();

      if (result.error) throw result.error;

      session = result.data.session;
    }

    onlineUser = session.user;

    if (onlineName) {
      await saveOnlineProfile();
      nameStatus.textContent = "Welcome back, " + onlineName + "! ✦";
    } else {
      nameStatus.textContent = "Choose your name to join the community!";
    }

    await loadLeaderboard(true);

  } catch (error) {
    console.error("STARBOUND connection error:", error);

    nameStatus.textContent =
      "Couldn't connect. Please check your internet connection.";

    leaderboardList.textContent = "Unable to load players.";
  }
}


async function saveOnlineProfile() {
  if (!onlineUser || !onlineName) return false;

  try {
    const { data: existingPlayer, error: findError } =
      await supabaseClient
        .from("players")
        .select("id")
        .eq("user_id", onlineUser.id)
        .maybeSingle();

    if (findError) throw findError;

    if (existingPlayer) {
      const { error } = await supabaseClient
        .from("players")
        .update({ display_name: onlineName })
        .eq("user_id", onlineUser.id);

      if (error) throw error;

    } else {
      const { error } = await supabaseClient
        .from("players")
        .insert({
          user_id: onlineUser.id,
          display_name: onlineName,
          high_score: 0
        });

      if (error) throw error;
    }

    return true;

  } catch (error) {
    console.error("Profile save error:", error);
    nameStatus.textContent = "Couldn't save your name. Try again.";
    return false;
  }
}


saveNameButton.addEventListener("click", async () => {
  const newName = nameInput.value.trim();

  if (!newName) {
    nameStatus.textContent = "Please enter a name first!";
    nameInput.focus();
    return;
  }

  if (newName.length > 20) {
    nameStatus.textContent = "Your name must be 20 characters or less.";
    return;
  }

  if (!onlineUser) {
    nameStatus.textContent = "Still connecting. Please try again in a moment.";
    return;
  }

  onlineName = newName;

  saveNameButton.disabled = true;
  saveNameButton.textContent = "SAVING...";

  const success = await saveOnlineProfile();

  saveNameButton.disabled = false;
  saveNameButton.textContent = "SAVE NAME";

  if (!success) return;

  localStorage.setItem("starbound-display-name", onlineName);

  nameStatus.textContent = "Your name is saved! Welcome to STARBOUND! ✦";

  await loadLeaderboard(true);
});



function getStarboundHighScore() {
  try {
    if (typeof stats !== "undefined" && stats) {
      return Number(stats.best || 0);
    }
  } catch (error) {
    console.warn("Could not read game stats:", error);
  }

  try {
    const saved = JSON.parse(
      localStorage.getItem("starbound-player-stats-v2") || "{}"
    );

    return Number(saved.best || 0);

  } catch (error) {
    return 0;
  }
}



async function syncOnlineScore() {
  if (!onlineUser || !onlineName) return;

  const score = getStarboundHighScore();

  if (!Number.isFinite(score) || score <= 0) return;

  try {
    const { data: player, error: fetchError } =
      await supabaseClient
        .from("players")
        .select("high_score")
        .eq("user_id", onlineUser.id)
        .maybeSingle();

    if (fetchError) throw fetchError;

    const previousBest = Number(player?.high_score || 0);

    if (score > previousBest) {
      const { error } = await supabaseClient
        .from("players")
        .update({ high_score: score })
        .eq("user_id", onlineUser.id);

      if (error) throw error;

      await loadLeaderboard(true);
    }

  } catch (error) {
    console.error("Score sync error:", error);
  }
}



async function getMyOnlineRank() {
  if (!onlineUser) return null;

  try {
    const { data: player, error } = await supabaseClient
      .from("players")
      .select("high_score")
      .eq("user_id", onlineUser.id)
      .maybeSingle();

    if (error) throw error;
    if (!player) return null;

    const { count, error: countError } = await supabaseClient
      .from("players")
      .select("id", { count: "exact", head: true })
      .gt("high_score", player.high_score);

    if (countError) throw countError;

    return (count || 0) + 1;

  } catch (error) {
    console.error("Rank error:", error);
    return null;
  }
}


async function loadLeaderboard(reset = false) {
  if (leaderboardLoading) return;

  if (reset) {
    leaderboardOffset = 0;
    leaderboardList.innerHTML = "";
    leaderboardHasMore = false;
  }

  leaderboardLoading = true;
  loadMoreButton.disabled = true;
  loadMoreButton.textContent = "LOADING...";

  leaderboardStatus.textContent = "Loading players...";

  try {
    let query = supabaseClient
      .from("players")
      .select("display_name, high_score, user_id, created_at", {
        count: "exact"
      })
      .order("high_score", { ascending: false })
      .order("created_at", { ascending: true });

    if (leaderboardSearch) {
      query = query.ilike(
        "display_name",
        "%" + leaderboardSearch + "%"
      );
    }

    const { data, error, count } = await query.range(
      leaderboardOffset,
      leaderboardOffset + PAGE_SIZE - 1
    );

    if (error) throw error;

    const players = data || [];

    if (reset && players.length === 0) {
      leaderboardList.innerHTML =
        "<p>No players found. Be the first STARBOUND legend!</p>";
    }

    const entries = players.map((player, index) => {
      const isYou = player.user_id === onlineUser?.id;
      const rank = leaderboardOffset + index + 1;

      return `
        <div class="leaderboard-entry ${isYou ? "you" : ""}">
          <span>
            <span class="player-rank">
              ${leaderboardSearch ? "" : "#" + rank}
            </span>
            ${escapeOnlineText(player.display_name || "Star Traveler")}
            ${isYou ? " ✦ YOU" : ""}
          </span>

          <span class="player-score">
            ${Number(player.high_score || 0).toLocaleString()}
          </span>
        </div>
      `;
    }).join("");

    leaderboardList.insertAdjacentHTML("beforeend", entries);

    leaderboardOffset += players.length;

    leaderboardHasMore = leaderboardOffset < (count || 0);

    loadMoreButton.hidden = !leaderboardHasMore;

    leaderboardStatus.textContent =
      `Showing ${leaderboardOffset} of ${count || 0} players`;

    if (!leaderboardSearch && onlineUser) {
      const rank = await getMyOnlineRank();

      leaderboardInfo.textContent = onlineName
        ? `Your name: ${onlineName}  |  Your rank: ${rank ? "#" + rank : "Not ranked yet"}`
        : "Enter a display name to join the leaderboard!";
    } else if (leaderboardSearch) {
      leaderboardInfo.textContent = "Search results";
    }

  } catch (error) {
    console.error("Leaderboard error:", error);

    leaderboardStatus.textContent =
      "Couldn't load players. Please try again.";

  } finally {
    leaderboardLoading = false;
    loadMoreButton.disabled = false;
    loadMoreButton.textContent = "LOAD MORE";
  }
}



loadMoreButton.addEventListener("click", () => {
  if (leaderboardHasMore) {
    loadLeaderboard(false);
  }
});



searchButton.addEventListener("click", () => {
  leaderboardSearch = searchInput.value.trim();
  loadLeaderboard(true);
});

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    leaderboardSearch = searchInput.value.trim();
    loadLeaderboard(true);
  }
});


function escapeOnlineText(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}



const originalStartGame = window.startGame;

window.startGame = async function (...args) {
  if (!onlineUser) {
    await initialiseOnlinePlayer();
  }

  const enteredName = nameInput.value.trim();

  if (!enteredName) {
    nameStatus.textContent =
      "Enter and save your name before starting your adventure!";

    nameInput.focus();
    return;
  }

  onlineName = enteredName.slice(0, 20);

  localStorage.setItem("starbound-display-name", onlineName);

  const saved = await saveOnlineProfile();

  if (!saved) return;

  nameStatus.textContent = "Let's go, " + onlineName + "! ✦";

  return originalStartGame.apply(this, args);
};



const originalSaveRun = window.saveRun;

window.saveRun = function (...args) {
  const result = originalSaveRun.apply(this, args);

  syncOnlineScore();

  return result;
};


initialiseOnlinePlayer()
