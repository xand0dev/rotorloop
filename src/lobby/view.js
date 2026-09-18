export function mountLobby(root, lobby) {
  root.innerHTML = `
    <section class="lobby-panel" aria-labelledby="lobby-title">
      <div class="lobby-kicker">PRE-FLIGHT / ASYNC LINK</div>
      <h1 id="lobby-title">Choose a flight room</h1>
      <p class="lobby-lede">Room traffic refreshes while this panel is open. Joining locks the flight plan and starts the local arena.</p>
      <form class="flight-plan" novalidate>
        <label class="call-sign">CALL SIGN<input name="playerName" autocomplete="nickname" maxlength="18" placeholder="e.g. KESTREL" /></label>
        <fieldset><legend>AVAILABLE ROOMS</legend><div class="room-list" role="radiogroup" aria-live="polite"></div></fieldset>
        <p class="form-status" aria-live="polite">CONTACTING CONTROL…</p>
        <button class="primary-action" type="submit" disabled>Join room</button>
      </form>
    </section>`;
  const form = root.querySelector("form");
  const roomList = root.querySelector(".room-list");
  const status = root.querySelector(".form-status");
  const submit = root.querySelector("button[type=submit]");

  function renderRooms(event) {
    roomList.replaceChildren();
    for (const [index, room] of event.detail.rooms.entries()) {
      const label = document.createElement("label");
      label.className = "room-option";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "room";
      radio.value = room.id;
      radio.checked = index === 0;
      const copy = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = room.name;
      const meta = document.createElement("small");
      meta.textContent = `${room.pilots}/${room.capacity} PILOTS · ${room.condition}`;
      copy.append(name, meta);
      label.append(radio, copy);
      roomList.append(label);
    }
    submit.disabled = event.detail.rooms.length === 0;
    status.textContent = `${event.detail.rooms.length} ROOMS ONLINE · AUTO-REFRESH ACTIVE`;
  }

  function renderError(event) {
    status.textContent = event.detail.timedOut
      ? "CONTROL LINK TIMED OUT · RETRYING AUTOMATICALLY"
      : "ROOM LIST UNAVAILABLE · RETRYING AUTOMATICALLY";
  }

  function renderValidation(event) {
    status.textContent = event.detail.message.toUpperCase();
    form.elements[event.detail.field]?.focus();
  }

  function submitPlan(event) {
    event.preventDefault();
    const data = new FormData(form);
    lobby.join(
      String(data.get("playerName") ?? ""),
      String(data.get("room") ?? ""),
    );
  }

  lobby.addEventListener("roomschange", renderRooms);
  lobby.addEventListener("error", renderError);
  lobby.addEventListener("validationerror", renderValidation);
  form.addEventListener("submit", submitPlan);
  return {
    destroy() {
      lobby.removeEventListener("roomschange", renderRooms);
      lobby.removeEventListener("error", renderError);
      lobby.removeEventListener("validationerror", renderValidation);
      form.removeEventListener("submit", submitPlan);
      root.replaceChildren();
    },
  };
}
