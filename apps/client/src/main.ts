import {
  BADGES,
  APARTMENT_ROOMS,
  levelOf,
  ACTIONS,
  ACTION_IDS,
  BUBBLE_STYLES,
  BUBBLE_STYLE_IDS,
  EMOTES,
  EMOTE_IDS,
  NOTE_COLORS,
  NOTE_MAX_LENGTH,
  RELATIONS,
  RELATION_IDS,
  bubbleUnlocked,
  type ActionKind,
  type EmoteKind,
  type RoomNote,
  CARRY,
  EFFECTS,
  EFFECT_IDS,
  OUTFIT_SLOTS,
  effectUnlocked,
  type CarryKind,
  type EffectId,
  EVENTS,
  WEEKDAYS,
  type ActiveEvent,
  CLOTHES,
  buildGrid,
  canPlace,
  DOOR_TILE,
  findPath,
  itemState,
  DEFAULT_LOOK,
  footprint,
  isWallItem,
  PROTOCOL_VERSION,
  RELEASE_NOTES,
  type ReleaseNote,
  SHOP_CATEGORIES,
  ROOM_GAMES,
  ROOM_GAME_IDS,
  MELODIES,
  MELODY_IDS,
  TEAM_NAMES,
  type RoomGameKind,
  MARKET_FEE,
  MARKET_MAX_LISTINGS,
  MARKET_MAX_PRICE,
  type MarketListing,
  PET_FEED_PRICE,
  PET_FEED_XP,
  PET_KIND_IDS,
  PET_KINDS,
  PET_MAX,
  PET_MAX_LEVEL,
  PET_TRICK_IDS,
  PET_TRICK_XP,
  PET_TRICKS,
  petXpFor,
  type PetKind,
  type PetKindDef,
  type PetTrick,
  type PetView,
  themeWallBlocks,
  isFloorTile,
  floorTileCount,
  renovationPrice,
  ROOM_SHAPES,
  ROOM_SHAPE_IDS,
  SIZE_PRICES,
  type RoomShape,
  ROOM_CATEGORIES,
  ROOM_CATEGORY_IDS,
  type RoomCategory,
  type Floor,
  STEP_HEIGHT,
  tileHeight,
  canStep,
  MAX_TILE_HEIGHT,
  WALLPAPERS,
  FLOORS,
  type WallpaperDef,
  type FloorDef,
  furniture,
  FURNITURE,
  FURNITURE_TYPES,
  DAILY_BONUS,
  HOTEL_BONUS,
  HOTEL_QUESTS,
  QUESTS,
  ROOM_SIZE,
  RUN_MULTIPLIER,
  sellPrice,
  WALK_SPEED,
  type FriendView,
  type PmLine,
  type FurnitureDef,
  type FurnitureType,
  type Look,
  type Me,
  type NavigatorRoom,
  type PlacedItem,
  type ProfileView,
  type RoomView,
  type ServerMsg,
  type AdminReport,
  type ClientMsg,
  type TradeOfferView,
  type TradeView,
} from '@hutel/shared';
import { Actor } from './actors';
import { Pet } from './gfx/pets';
import {
  accessToken,
  isAuthRedirect,
  loadConfig,
  signInWithEmail,
  signInWithProvider,
  signOut,
  type AuthConfig,
} from './auth';
import { buildFurniture, drawTv } from './gfx/furniture';
import { T, tw } from './gfx/helpers';
import { createRoom } from './gfx/room';
import { createStage } from './gfx/scene';
import { Net } from './net';
import * as audio from './audio';
import { playTutorial } from './tutorial';
import { $, COIN, confetti, setCoinText, esc, logLine, lookEditor, pop, toast } from './ui';

const envServer = (import.meta.env.VITE_SERVER_URL as string | undefined) || '';
// Dev (Vite on :5173) talks to the server on :2567; in production the server serves the client itself.
const SERVER =
  envServer ||
  (location.port === '5173' ? `${location.protocol}//${location.hostname}:2567` : location.origin);
const WS_URL = SERVER.replace(/^http/, 'ws') + '/ws';
const TOKEN_KEY = 'hutel-token';
/**
 * After a deploy an open tab keeps playing on the new server. Small updates only show a button;
 * an incompatible protocol asks the player to reload (otherwise things break).
 */
let updateShown = false;
function offerUpdate(notes: ReleaseNote | undefined, must: boolean) {
  if (updateShown) return;
  updateShown = true;
  const bar = $('updateBar');
  const what = notes ? esc(notes.title) : 'Nye forbedringer';
  bar.innerHTML = must
    ? `<b>✨ Hutel er blevet opdateret</b><span>${what}</span><button id="upGo" class="small primary">Opdater nu</button>`
    : `<b>✨ Ny version</b><span>${what}</span><button id="upNews" class="small">Se nyt</button><button id="upGo" class="small primary">Opdater</button><button id="upLater" class="small" title="Senere">✕</button>`;
  bar.classList.remove('hidden');
  $('upGo').addEventListener('click', () => location.reload());
  $('upLater')?.addEventListener('click', () => bar.classList.add('hidden'));
  $('upNews')?.addEventListener('click', () => showNotes(notes, true));
  if (must) {
    // Give the player a moment, then fetch the new version for them.
    showNotes(notes, true, true);
    setTimeout(() => location.reload(), 20_000);
  }
}

/** "What's new" panel. */
function showNotes(notes: ReleaseNote | undefined, pending: boolean, must = false) {
  if (!notes) return;
  openPanel(
    'notes',
    head(
      `✨ ${must ? 'Hutel er blevet opdateret' : pending ? 'Ny version klar' : 'Nyt i Hutel'}`,
      esc(notes.title),
    ) +
      `<ul class="notes">${notes.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` +
      (pending
        ? `<p class="sub">${must ? 'Siden opdaterer om lidt, så du kan fortsætte.' : 'Du kan blive ved med at spille og opdatere, når det passer dig.'}</p><button class="primary" id="notesGo">Opdater nu</button>`
        : ''),
  );
  $('notesGo')?.addEventListener('click', () => location.reload());
}

/** Shows "what's new" once after the page loaded a new version. */
function maybeShowNews() {
  try {
    const seen = localStorage.getItem('hutel-seen-build');
    localStorage.setItem('hutel-seen-build', __BUILD_ID__);
    if (seen && seen !== __BUILD_ID__) setTimeout(() => showNotes(RELEASE_NOTES[0], false), 1500);
  } catch {
    /* private mode */
  }
}
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

/* ---------------- scene ---------------- */
const stage = createStage($('app'));
const roomGfx = createRoom(stage.scene);
const furnRoot = new T.Group();
stage.scene.add(furnRoot);
const overlay = $('overlay');
const cv = stage.renderer.domElement;

const hoverM = new T.Mesh(
  new T.PlaneGeometry(0.92, 0.92),
  new T.MeshBasicMaterial({ color: 0xfff3d6, transparent: true, opacity: 0.28, depthWrite: false }),
);
hoverM.rotation.x = -Math.PI / 2;
hoverM.visible = false;
stage.scene.add(hoverM);
const placeM = new T.Mesh(
  new T.PlaneGeometry(1, 1),
  new T.MeshBasicMaterial({ color: 0x6fd36f, transparent: true, opacity: 0.42, depthWrite: false }),
);
placeM.rotation.x = -Math.PI / 2;
placeM.visible = false;
stage.scene.add(placeM);
let gridHelper = makeGrid(ROOM_SIZE);
function makeGrid(n: number) {
  const g = new T.GridHelper(n, n, 0xfff0d0, 0xfff0d0);
  g.position.y = 0.006;
  (g.material as T.Material).transparent = true;
  (g.material as T.Material).opacity = 0.28;
  g.visible = false;
  g.userData.size = n;
  stage.scene.add(g);
  return g;
}
/** Size of the room we are in. */
const rs = () => room?.size ?? ROOM_SIZE;
/** Size and floor plan of the room we are in. */
const fl = (): Floor =>
  room ? { size: room.size, shape: room.shape, heights: room.heights } : ROOM_SIZE;
/** World height of the floor at tile coordinates (x, z). */
const groundAt = (x: number, z: number) =>
  room ? tileHeight(fl(), Math.round(x), Math.round(z)) * STEP_HEIGHT : 0;

/* ---------------- state ---------------- */
let net: Net | null = null;
let me: Me | null = null;
let room: RoomView | null = null;
const items = new Map<number, PlacedItem>();
const objs = new Map<number, T.Group>();
const actors = new Map<string, Actor>();
let friends: FriendView[] = [];
/** Pets following players in this room, keyed by owner id. */
const pets = new Map<string, Pet>();
function syncPet(ownerId: string, view: PetView | null | undefined) {
  const old = pets.get(ownerId);
  if (
    old &&
    view &&
    old.view.kind === view.kind &&
    old.view.color === view.color &&
    old.view.level === view.level
  ) {
    old.view = view;
    return;
  }
  old?.dispose(stage.scene);
  pets.delete(ownerId);
  const a = actors.get(ownerId);
  if (view && a) pets.set(ownerId, new Pet(view, ownerId, stage.scene, a.obj.position));
}
const pmLog = new Map<string, PmLine[]>();
let pmWith: string | null = null;
let requests: { id: string; name: string }[] = [];
let build = false;
let held: { item: PlacedItem; isNew: boolean; orig?: PlacedItem; inv?: number } | null = null;
let running = false;
const keys = new Set<string>();
let panelKind: string | null = null;
let onboardingLock = true;
let canReset = false;

const myActor = () => (me ? actors.get(me.id) : undefined);

/* Client-side prediction: our own figure starts walking at once, and the server's echo of
   the same walk is ignored. If the server disagrees (blocked, seat, etc.) its path wins. */
const pending: { goal: string; at: number }[] = [];
function expectEcho(goal: [number, number]) {
  const now = performance.now();
  while (pending.length && now - pending[0]!.at > 2500) pending.shift();
  pending.push({ goal: goal.join(), at: now });
}
function isOwnEcho(goal: [number, number]) {
  const i = pending.findIndex((p) => p.goal === goal.join());
  if (i < 0) return false;
  pending.splice(0, i + 1);
  return true;
}
function predictWalk(goal: [number, number], run: boolean) {
  const a = myActor();
  if (!a || !net || a.seatId !== null) return;
  const now = net.now();
  const next = a.heading(now);
  const grid = buildGrid(fl(), [...items.values()]);
  const found = findPath(grid, next, goal);
  const rest = found?.map(([x, z]): [number, number] => [x, z]);
  if (!rest) return;
  const here: [number, number] = [a.x, a.z];
  const atNext = Math.hypot(next[0] - a.x, next[1] - a.z) < 0.01;
  a.setPath(atNext ? next : here, atNext ? rest : [next, ...rest], now, run, null);
  expectEcho(goal);
}
const onboarded = () => !!me && (!onboardingLock || QUESTS.every((q) => me!.quests.includes(q.id)));
const questsDone = () => !!me && QUESTS.every((q) => me!.quests.includes(q.id));
const isOwner = () => !!me && !!room && room.ownerId === me.id;

/* ---------------- bubbles ---------------- */
interface Bubble {
  el: HTMLDivElement;
  who: string;
  born: number;
  off: number;
}
const bubbles: Bubble[] = [];
function bubble(
  id: string,
  name: string,
  text: string,
  whisper = false,
  style?: string,
  shout = false,
) {
  for (const b of bubbles) if (b.who === id) b.off += (b.el.offsetHeight || 30) + 6;
  const el = document.createElement('div');
  const st = style
    ? (BUBBLE_STYLES as Record<string, { bg: string; fg: string; shape: string }>)[style]
    : undefined;
  el.className =
    'bubble' +
    (whisper ? ' whisper' : '') +
    (shout ? ' shout' : '') +
    (st ? ` shape-${st.shape}` : '');
  if (st && !whisper) {
    el.style.setProperty('--bb', st.bg);
    el.style.setProperty('--bf', st.fg);
  }
  const b = document.createElement('b');
  b.textContent = name + ':';
  el.append(b, document.createTextNode(text));
  overlay.appendChild(el);
  bubbles.push({ el, who: id, born: performance.now(), off: 0 });
}

/* ---------------- emotes over heads ---------------- */
const floats: { el: HTMLDivElement; who: string; born: number; dx: number }[] = [];
function floatEmote(id: string, icon: string) {
  if (!actors.has(id)) return;
  const el = document.createElement('div');
  el.className = 'emote';
  el.textContent = icon;
  overlay.appendChild(el);
  floats.push({ el, who: id, born: performance.now(), dx: (Math.random() - 0.5) * 24 });
}
/** Sleepers snore 💤 and thinkers get a 💭 now and then. */
let lastIdleEmote = 0;
function idleEmotes(t: number) {
  if (t - lastIdleEmote < 2200) return;
  lastIdleEmote = t;
  for (const [id, a] of actors) {
    if (a.walking) continue;
    if (a.action === 'sleep') floatEmote(id, '💤');
    else if (a.action === 'think') floatEmote(id, '💭');
  }
}
function updateFloats(t: number) {
  idleEmotes(t);
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]!;
    const age = (t - f.born) / 1000;
    const anchor = actors.get(f.who)?.obj;
    if (age > 2.2 || !anchor) {
      f.el.remove();
      floats.splice(i, 1);
      continue;
    }
    const [x, y] = screenAt(anchor, 1.9);
    f.el.style.transform = `translate(${x + f.dx + Math.sin(age * 5) * 4}px,${y - age * 45}px) translate(-50%,-100%) scale(${Math.min(1, age * 5)})`;
    f.el.style.opacity = String(age > 1.6 ? Math.max(0, (2.2 - age) / 0.6) : 1);
  }
}

/* ---------------- furniture objects ---------------- */
function placeObj(it: PlacedItem, lift = 0) {
  let g = objs.get(it.id);
  const st = itemState(it);
  if (
    !g ||
    g.userData.type !== it.type ||
    g.userData.color !== (it.color ?? 0) ||
    g.userData.state !== st
  ) {
    if (g) furnRoot.remove(g);
    g = buildFurniture(it.type, it.id, it.color ?? 0, st);
    g.userData.type = it.type;
    g.userData.color = it.color ?? 0;
    g.userData.state = st;
    furnRoot.add(g);
    objs.set(it.id, g);
  }
  if (isWallItem(it.type)) {
    const c = tw(it.x) + (furniture(it.type).w - 1) / 2;
    if (it.rot % 2) g.position.set(-rs() / 2, lift, c);
    else g.position.set(c, lift, -rs() / 2);
    g.rotation.y = it.rot % 2 ? Math.PI / 2 : 0;
    return g;
  }
  const f = footprint(it);
  g.position.set(tw(it.x) + (f.w - 1) / 2, lift + groundAt(it.x, it.z), tw(it.z) + (f.d - 1) / 2);
  g.rotation.y = (it.rot * Math.PI) / 2;
  return g;
}
function removeObj(id: number) {
  const g = objs.get(id);
  if (g) furnRoot.remove(g);
  objs.delete(id);
}

/* ---------------- room ---------------- */
function setRoom(view: RoomView) {
  cancelHeld();
  setBuild(false);
  room = view;
  for (const a of actors.values()) a.dispose(stage.scene);
  actors.clear();
  for (const p of pets.values()) p.dispose(stage.scene);
  pets.clear();
  for (const b of bubbles) b.el.remove();
  bubbles.length = 0;
  for (const id of [...objs.keys()]) removeObj(id);
  items.clear();
  if (view.size !== gridHelper.userData.size) {
    stage.scene.remove(gridHelper);
    gridHelper.geometry.dispose();
    gridHelper = makeGrid(view.size);
  }
  roomGfx.setSize(view.size, view.shape, view.heights);
  stage.setRoomSize(view.size);
  roomGfx.setTheme(view.theme);
  roomGfx.setAptDoors(view.doors);
  setTimeout(updateGameBar, 0);
  applyDecor();
  audio.stopAllJukeboxes();
  for (const it of view.items) {
    items.set(it.id, it);
    placeObj(it);
    if (it.type === 'jukebox') audio.setJukebox(it.id, it.song, it.songAt);
  }
  for (const p of view.players) {
    actors.set(p.id, new Actor(p, stage.scene, overlay, p.id === me?.id));
    syncPet(p.id, p.pet);
  }
  updateRoomUi();
  logLine({ text: `*** Du er i ${view.name}`, cls: 'sys' });
  roomGfx.openDoor(false);
  setTimeout(() => $('fade').classList.remove('on'), 120);
}

const wallDef = (id: string | null) =>
  id && id in WALLPAPERS ? (WALLPAPERS[id as keyof typeof WALLPAPERS] as WallpaperDef) : null;
const floorDef = (id: string | null) =>
  id && id in FLOORS ? (FLOORS[id as keyof typeof FLOORS] as FloorDef) : null;
function applyDecor() {
  if (!room) return;
  roomGfx.setDecor(wallDef(room.wall), floorDef(room.floor));
}

function updateRoomUi() {
  if (!room || !me) return;
  $('roomName').textContent = room.ownerName
    ? `${room.name} · ${room.ownerName}`
    : `${room.name} · Hutel.dk`;
  $<HTMLButtonElement>('bBuild').disabled = !room.canBuild;
  $<HTMLButtonElement>('bShop').disabled = !isOwner();
  roomGfx.setDoorUnlocked(onboarded());
  renderEventBar();
  const showQuests = questsDone() || room.id === me.homeRoomId;
  $('quests').classList.toggle('hidden', !showQuests);
  $('quests').classList.remove('gone');
  renderQuests();
}

function goTo(roomId: string, password?: string) {
  if (room?.id === roomId) return closePanel();
  closePanel();
  roomGfx.openDoor(true);
  $('fade').classList.add('on');
  setTimeout(() => net?.send({ t: 'join', roomId, password }), 350);
  setTimeout(() => $('fade').classList.remove('on'), 2500);
}

/* ---------------- quests / coins ---------------- */
function questLi(done: boolean, text: string, reward: number, extra = '') {
  return `<li class="${done ? 'done' : ''}"><span>${done ? '✅' : '⬜'}</span><span class="t">${esc(text)}${extra}</span><span class="r">+${reward} ${COIN}</span></li>`;
}
function renderQuests() {
  if (!me) return;
  if (!questsDone()) {
    $('qTitle').textContent = '✨ Startopgaver';
    $('qlist').innerHTML = QUESTS.map((q) =>
      questLi(me!.quests.includes(q.id), q.text, q.reward),
    ).join('');
    $('qCount').textContent =
      `${QUESTS.filter((q) => me!.quests.includes(q.id)).length}/${QUESTS.length}`;
    return;
  }
  const hotelLeft = HOTEL_QUESTS.some((q) => !me!.quests.includes(q.id));
  const d = me.daily;
  const dailyDone = d.quests.filter((q) => q.done).length;
  let html = '';
  if (hotelLeft)
    html += HOTEL_QUESTS.map((q) => questLi(me!.quests.includes(q.id), q.text, q.reward)).join('');
  html += `<li class="qsub"><span>📅 Dagens opgaver</span><span>${d.streak ? `🔥 ${d.streak} ${d.streak === 1 ? 'dag' : 'dage'} i træk` : `+${DAILY_BONUS} ${COIN} for alle`}</span></li>`;
  html += d.quests
    .map((q) =>
      questLi(
        q.done,
        q.text,
        q.reward,
        !q.done && q.goal > 1 ? ` <small>(${q.progress}/${q.goal})</small>` : '',
      ),
    )
    .join('');
  $('qlist').innerHTML = html;
  $('qTitle').textContent = hotelLeft ? '🗺️ Hotel-opgaver' : '📅 Dagens opgaver';
  $('qCount').textContent = hotelLeft
    ? `${HOTEL_QUESTS.filter((q) => me!.quests.includes(q.id)).length}/${HOTEL_QUESTS.length}`
    : `${dailyDone}/${d.quests.length}`;
}
function setCoins(c: number) {
  if (!me) return;
  me.coins = c;
  setCoinText($('coinVal'), `🪙 ${c}`);
  if (panelKind === 'shop') renderShop();
}
function setOnline(sec: number) {
  if (!me) return;
  me.onlineSec = sec;
  setCoinText(
    $('online'),
    innerWidth < 760
      ? `⏱ ${Math.floor(sec / 60)} min · +1/min`
      : `⏱ Online ${Math.floor(sec / 60)} min · +1 🪙 pr. minut`,
  );
}

/* ---------------- server messages ---------------- */
function handle(msg: ServerMsg) {
  switch (msg.t) {
    case 'welcome':
      if (msg.protocol && msg.protocol !== PROTOCOL_VERSION) offerUpdate(msg.notes, true);
      else if (msg.build && msg.build !== __BUILD_ID__) offerUpdate(msg.notes, false);
      else if (!updateShown) maybeShowNews();
      net?.send({ t: 'ping' }); // sync the clock right away (jukebox, games)
      me = msg.me;
      onboardingLock = msg.onboardingLock;
      canReset = msg.canReset;
      setCoins(me.coins);
      setOnline(me.onlineSec);
      $('signup').classList.add('hidden');
      return;
    case 'room':
      audio.sfx('door');
      return setRoom(msg.room);
    case 'market':
      market = { listings: msg.listings, mine: msg.mine };
      if (panelKind === 'market') renderMarket();
      return;
    case 'pets':
      if (me) {
        me.pets = msg.pets;
        me.activePet = msg.active;
      }
      if (panelKind === 'pets') renderPets();
      return;
    case 'petView':
      return syncPet(msg.ownerId, msg.pet);
    case 'petAct': {
      const p = pets.get(msg.ownerId);
      if (!p) return;
      p.play(msg.act);
      audio.sfx(({ hund: 'woof', kat: 'meow', drage: 'roar' } as const)[p.view.kind] ?? 'woof');
      if (msg.say)
        bubble(`pet:${msg.ownerId}`, `${PET_KINDS[p.view.kind].icon} ${p.view.name}`, msg.say);
      return;
    }
    case 'roomGame': {
      const prev = room?.game?.phase;
      if (msg.game?.phase === 'countdown' && prev !== 'countdown') audio.sfx('tick');
      if (msg.game?.phase === 'play' && prev !== 'play') audio.sfx('go');
      if (!msg.game && prev === 'play') audio.sfx('win');
      if (room) room.game = msg.game;
      updateGameBar();
      if (msg.game?.phase === 'play' && panelKind === 'game') closePanel();
      return;
    }
    case 'heights':
      if (!room) return;
      room.heights = msg.heights;
      roomGfx.setHeights(msg.heights);
      for (const it of items.values()) placeObj(it);
      return;
    case 'decor':
      if (room) {
        room.wall = msg.wall;
        room.floor = msg.floor;
        applyDecor();
      }
      if (me && msg.owned) me.decor = msg.owned;
      if (panelKind === 'shop') renderShop();
      return;
    case 'playerJoin':
      if (!actors.has(msg.player.id)) {
        actors.set(msg.player.id, new Actor(msg.player, stage.scene, overlay, false));
        syncPet(msg.player.id, msg.player.pet);
      }
      if (!msg.player.bot) logLine({ text: `*** ${msg.player.name} kom ind`, cls: 'sys' });
      return;
    case 'playerLeave': {
      const a = actors.get(msg.id);
      if (a) {
        if (!a.view.bot) logLine({ text: `*** ${a.view.name} gik`, cls: 'sys' });
        a.dispose(stage.scene);
        actors.delete(msg.id);
        syncPet(msg.id, null);
      }
      return;
    }
    case 'daily': {
      if (!me) return;
      me.daily = msg.daily;
      renderQuests();
      const q = msg.daily.quests.find((x) => x.id === msg.doneId);
      if (q) toast(`✅ ${q.text} · +${q.reward} 🪙`);
      if (msg.bonus)
        setTimeout(() => {
          confetti();
          toast(
            `📅 Dagens opgaver klaret! +${msg.bonus} 🪙 · 🔥 ${msg.daily.streak} ${msg.daily.streak === 1 ? 'dag' : 'dage'} i træk`,
          );
        }, 1400);
      return;
    }
    case 'wardrobe': {
      if (!me) return;
      me.wardrobe = msg.wardrobe;
      if (wearAfterBuy && msg.wardrobe.includes(wearAfterBuy)) {
        const [slot, v] = wearAfterBuy.split(':') as ['top' | 'hat', string];
        me.look = { ...me.look, [slot]: v } as Look;
        myActor()?.setLook(me.look);
        net?.send({ t: 'look', look: me.look });
        wearAfterBuy = null;
      }
      if (panelKind === 'fig') renderFigure();
      return;
    }
    case 'events':
      events = msg.events;
      renderEventBar();
      if (panelKind === 'nav' && lastRooms) renderNavigator(lastRooms);
      return;
    case 'tag':
      actors.get(msg.id)?.setTag(msg.level);
      if (me && msg.id === me.id && msg.shown !== undefined) {
        me.showBadge = msg.shown;
        if (panelKind === 'fig') renderFigure();
      }
      return;
    case 'adminReports':
      return renderAdmin(msg.reports);
    case 'apartment':
      if (!me) return;
      me.apartment = msg.rooms;
      // a new room was bought – the server moves us there next
      if (panelKind === 'nav') closePanel();
      return;
    case 'sys':
      logLine({ text: msg.text, cls: 'game' });
      if (msg.id) bubble(msg.id, '🎮', msg.text);
      return;
    case 'inventory':
      if (!me) return;
      me.inventory = msg.items;
      if (panelKind === 'shop') renderShop();
      if (panelKind === 'market') renderMarket();
      if (trade) renderTrade();
      return;
    case 'tradeAsk':
      return renderTradeAsk(msg.from);
    case 'trade':
      trade = msg.trade;
      return renderTrade();
    case 'tradeEnd':
      trade = null;
      if (panelKind === 'trade' || panelKind === 'tradeAsk') closePanel();
      if (msg.done) confetti();
      return toast(msg.text, msg.done ? 'info' : 'error');
    case 'resetDone':
      location.reload();
      return;
    case 'path': {
      if (msg.id === me?.id && msg.glide) return; // our own arrow-key walk
      if (msg.id === me?.id && msg.seatId === null) {
        const last = msg.path[msg.path.length - 1] ?? msg.from;
        if (isOwnEcho([last[0], last[1]])) return;
      }
      actors.get(msg.id)?.setPath(msg.from, msg.path, msg.pathStart, msg.run, msg.seatId);
      return;
    }
    case 'chat':
      if (msg.id !== me?.id) audio.sfx(msg.shout ? 'go' : 'chat');
      bubble(
        msg.id,
        (msg.shout ? '📢 ' : '') + (msg.bot ? '🤖 ' : '') + msg.name,
        msg.text,
        false,
        msg.style,
        msg.shout,
      );
      logLine({
        name: (msg.shout ? '📢 ' : '') + (msg.bot ? '🤖 ' : '') + msg.name,
        text: msg.text,
        cls: msg.shout ? 'shout' : undefined,
      });
      return;
    case 'emote':
      floatEmote(msg.id, EMOTES[msg.kind]);
      return;
    case 'effect':
      actors.get(msg.id)?.setEffect(msg.effect === 'none' ? undefined : msg.effect);
      if (me && msg.id === me.id) {
        me.effect = msg.effect === 'none' ? undefined : msg.effect;
        if (panelKind === 'fig') renderFigure();
      }
      return;
    case 'carry':
      actors.get(msg.id)?.setCarry(msg.item);
      if (me && msg.id === me.id && panelKind === 'moves') renderMoves();
      return;
    case 'notes':
      roomNotes = msg.notes;
      notesMod = msg.canModerate;
      if (panelKind === 'notes') renderNotes();
      return;
    case 'whisper': {
      const mine = msg.from === me?.id;
      if (!mine) audio.sfx('whisper');
      const other = mine ? msg.to : msg.from;
      const line = { from: msg.from, text: msg.text, at: msg.at };
      pmLog.set(other, [...(pmLog.get(other) ?? []), line].slice(-50));
      if (panelKind === 'pm' && pmWith === other) {
        renderPm(other);
        if (!mine) net?.send({ t: 'pmHistory', with: other });
      } else if (!mine) toast(`💬 ${msg.fromName}: ${msg.text.slice(0, 60)}`);
      return;
    }
    case 'hush': {
      const mine = msg.from === me?.id;
      logLine({
        name: mine ? `🤫 Du hvisker til ${msg.toName}` : `🤫 ${msg.fromName} hvisker`,
        text: msg.text,
        cls: 'pm',
      });
      if (actors.has(msg.from)) bubble(msg.from, `🤫 ${msg.fromName}`, msg.text, true);
      return;
    }
    case 'pmHistory':
      pmLog.set(msg.with, msg.msgs);
      if (panelKind === 'pm' && pmWith === msg.with) renderPm(msg.with);
      return;
    case 'action':
      actors.get(msg.id)?.setAction(msg.kind);
      return;
    case 'look':
      actors.get(msg.id)?.setLook(msg.look);
      if (me && msg.id === me.id) me.look = msg.look;
      return;
    case 'itemPut':
      items.set(msg.item.id, msg.item);
      if (msg.item.type === 'jukebox') {
        audio.setJukebox(msg.item.id, msg.item.song, msg.item.songAt);
        if (panelKind === 'jukebox') renderJukebox(msg.item.id);
      }
      if (held?.item.id !== msg.item.id) placeObj(msg.item);
      return;
    case 'itemRemove':
      audio.setJukebox(msg.id, undefined, undefined);
      items.delete(msg.id);
      removeObj(msg.id);
      return;
    case 'roomMeta':
      if (room)
        Object.assign(room, {
          name: msg.name,
          description: msg.description,
          access: msg.access,
          category: msg.category,
        });
      return updateRoomUi();
    case 'coins': {
      const diff = me ? msg.coins - me.coins : 0;
      setCoins(msg.coins);
      if (diff > 0) pop(`+${diff} 🪙`);
      if (diff > 0) audio.sfx('coin');
      else if (diff < 0) audio.sfx('spend');
      return;
    }
    case 'online':
      return setOnline(msg.onlineSec);
    case 'quest': {
      if (!me) return;
      if (!me.quests.includes(msg.id)) me.quests.push(msg.id);
      audio.sfx('quest');
      const q = [...QUESTS, ...HOTEL_QUESTS].find((x) => x.id === msg.id)!;
      toast(`✅ ${q.text} · +${msg.reward} 🪙`);
      renderQuests();
      if (msg.hotelAll)
        setTimeout(() => {
          confetti();
          toast(`🗝️ Alle hotel-opgaver klaret! Du er nu Hotelkender · +${HOTEL_BONUS} 🪙`);
          renderQuests();
        }, 1200);
      if (msg.all)
        setTimeout(() => {
          confetti();
          toast('🎉 Alle startopgaver klaret! Døren er åben – tryk på Rum og find lobbyen 🚪');
          $('quests').classList.add('gone');
          setTimeout(() => updateRoomUi(), 1600);
        }, 1200);
      return;
    }
    case 'badge':
      me?.badges.push(msg.id);
      audio.sfx('badge');
      return toast(`${BADGES[msg.id].icon} Nyt badge: ${BADGES[msg.id].name}`);
    case 'friends':
      friends = msg.friends;
      requests = msg.requests;
      $('reqDot').classList.toggle(
        'hidden',
        !requests.length && !friends.some((f) => f.unread > 0),
      );
      if (panelKind === 'friends') renderFriends();
      return;
    case 'navigator':
      if ((msg.q ?? '') !== navQuery) return; // an older search
      if (msg.cat && msg.cat !== navTab) return; // an older category
      lastRooms = msg.rooms;
      clearTimeout(navRetry);
      if (panelKind === 'nav') renderNavigator(msg.rooms);
      return;
    case 'profile':
      return renderProfile(msg.profile);
    case 'toast':
      $('fade').classList.remove('on');
      roomGfx.openDoor(false);
      if (msg.kind === 'error') audio.sfx('error');
      return toast(msg.text, msg.kind);
    case 'needPassword':
      $('fade').classList.remove('on');
      roomGfx.openDoor(false);
      return renderPassword(msg.roomId);
    case 'pong':
      return;
  }
}

/* ---------------- panels ---------------- */
let stopTutorial: (() => void) | null = null;
function openPanel(kind: string, html: string) {
  if (panelKind !== kind) audio.sfx('open');
  stopTutorial?.();
  stopTutorial = null;
  panelKind = kind;
  const p = $('panel');
  p.innerHTML = html;
  p.classList.remove('hidden');
  p.querySelector('[data-close]')?.addEventListener('click', closePanel);
  for (const id of ['bNav', 'bFriends', 'bFig', 'bShop']) $(id).classList.remove('on');
  const btn = { nav: 'bNav', friends: 'bFriends', fig: 'bFig', shop: 'bShop' }[kind];
  if (btn) $(btn).classList.add('on');
}
function closePanel() {
  stopTutorial?.();
  stopTutorial = null;
  panelKind = null;
  $('panel').classList.add('hidden');
  for (const id of ['bNav', 'bFriends', 'bFig', 'bShop']) $(id).classList.remove('on');
}
const head = (title: string, sub = '') =>
  `<h2>${title} <button class="x" data-close>✕</button></h2>${sub ? `<p class="sub">${sub}</p>` : ''}`;
const toggle = (kind: string, open: () => void) => () =>
  panelKind === kind ? closePanel() : open();

let lastRooms: NavigatorRoom[] | null = null;
let events: ActiveEvent[] = [];
const eventsRunning = () => events.length > 0;
function renderEventBar() {
  const e = events[0];
  const bar = $('eventBar');
  bar.classList.toggle('hidden', !e);
  if (!e) return;
  const here = room?.id === e.roomId;
  bar.innerHTML = `🎉 <b>${esc(e.name)}</b> lige nu · dobbelt mønter ${here ? '– du er med! 🥳' : `<button id="evGo" class="small primary">Gå med</button>`}`;
  document
    .getElementById('evGo')
    ?.addEventListener('click', () =>
      onboarded() ? goTo(e.roomId) : toast('Klar startopgaverne først – så åbner hotellet sig 🚪'),
    );
}
let navRetry: number | undefined;
function openNavigator() {
  if (panelKind === 'nav') return;
  // Always open on the popular rooms (not on an empty tab from last time).
  navTab = 'popular';
  navQuery = '';
  // Show the last list at once (it refreshes when the answer arrives).
  if (lastRooms) renderNavigator(lastRooms);
  else
    openPanel(
      'nav',
      head('🧭 Navigator', 'Gå på opdagelse i hotellet.') + '<p class="sub">Henter rum…</p>',
    );
  net?.send(navRequest());
  clearTimeout(navRetry);
  navRetry = window.setTimeout(() => {
    if (panelKind === 'nav') net?.send(navRequest());
  }, 1500);
}
type NavTab = 'popular' | 'fav' | RoomCategory;
const navRequest = () => ({
  t: 'navigator' as const,
  q: navQuery || undefined,
  cat: navTab !== 'popular' && navTab !== 'fav' && !navQuery ? navTab : undefined,
});
let navTab: NavTab = 'popular';
let navQuery = '';
let navSearchTimer = 0;
function renderNavigator(rooms: NavigatorRoom[]) {
  const row = (r: NavigatorRoom) =>
    `<div class="li"><button class="star${r.fav ? ' on' : ''}" data-fav="${esc(r.id)}" title="${r.fav ? 'Fjern fra favoritter' : 'Tilføj til favoritter'}">${r.fav ? '★' : '☆'}</button><div class="grow"><b>${ROOM_CATEGORIES[r.category].icon} ${esc(r.name)}</b>${events.some((e) => e.roomId === r.id) ? ' <span class="evtag">🎉 Event</span>' : ''}${r.access !== 'open' ? (r.access === 'locked' ? ' 🔒' : ' 🔑') : ''}<small>${esc(r.description || (r.ownerName ? `Af ${r.ownerName}` : ''))}</small></div><span class="users${r.users >= r.max ? ' full' : ''}">👤 ${r.users}/${r.max}</span>${r.users >= r.max && room?.id !== r.id ? '<button class="small" disabled>Fyldt</button>' : `<button class="small" data-go="${esc(r.id)}">${room?.id === r.id ? 'Her' : 'Gå'}</button>`}</div>`;
  const inTab = (r: NavigatorRoom) =>
    navTab === 'popular' ? true : navTab === 'fav' ? r.fav : r.category === navTab;
  const shown = rooms.filter(inTab);
  const pub = shown.filter((r) => r.public);
  const guest = shown
    .filter(
      (r) =>
        !r.public &&
        (navQuery || navTab !== 'popular' || !me?.apartment.some((a) => a.id === r.id)),
    )
    .sort((a, b) => b.users - a.users);
  const tabs = (['popular', 'fav', ...ROOM_CATEGORY_IDS] as NavTab[])
    .map((t) => {
      const label =
        t === 'popular'
          ? '🔥 Populære'
          : t === 'fav'
            ? '⭐ Favoritter'
            : `${ROOM_CATEGORIES[t].icon} ${ROOM_CATEGORIES[t].name}`;
      return `<button class="${navTab === t ? 'on' : ''}" data-tab="${t}">${label}</button>`;
    })
    .join('');
  const search = `<div class="row" style="display:flex;gap:6px"><input id="navQ" maxlength="30" placeholder="🔍 Søg efter rum eller ejer…" value="${esc(navQuery)}" style="flex:1"></div><div class="chips navtabs">${tabs}</div>`;
  const own =
    isOwner() && room
      ? `<h3>Dit værelse</h3><div class="row"><input id="rsName" maxlength="30" value="${esc(room.name)}" style="width:100%"></div>
       <div class="row"><input id="rsDesc" maxlength="80" placeholder="Beskrivelse" value="${esc(room.description)}" style="width:100%"></div>
       <div class="row" style="display:flex;gap:6px;flex-wrap:wrap"><select id="rsAccess"><option value="open">Åbent for alle</option><option value="locked">Låst</option><option value="password">Adgangskode</option></select>
       <input id="rsPw" type="password" maxlength="40" placeholder="Ny adgangskode"><button id="rsSave" class="small primary">Gem</button></div>
        <div class="row" style="display:flex;gap:6px;align-items:center"><span class="sub">Kategori:</span><select id="rsCat">${ROOM_CATEGORY_IDS.map((c) => `<option value="${c}">${ROOM_CATEGORIES[c].icon} ${ROOM_CATEGORIES[c].name}</option>`).join('')}</select></div>
       <div class="row"><button id="rsRenovate" class="small">📐 Byg om: størrelse og form (${room.size}×${room.size}, ${ROOM_SHAPES[room.shape].name})</button></div>`
      : '';
  const myLevel = me ? levelOf(me).level : 1;
  const apt = me
    ? `<h3>🏠 Min lejlighed</h3><div class="list">${me.apartment
        .map(
          (r) =>
            `<div class="li"><div class="grow"><b>${r.kind === 'living' ? '🛋️' : (APARTMENT_ROOMS.find((a) => a.kind === r.kind)?.icon ?? '')} ${esc(r.name)}</b></div><button class="small" data-go="${esc(r.id)}">${room?.id === r.id ? 'Her' : 'Gå'}</button></div>`,
        )
        .join('')}${APARTMENT_ROOMS.filter((a) => !me!.apartment.some((r) => r.kind === a.kind))
        .map((a) => {
          const locked = myLevel < a.level;
          return `<div class="li"><div class="grow"><b>${a.icon} ${a.name}</b><small>${locked ? `Kræver level ${a.level}` : `Køb for ${a.price} mønter`}</small></div><button class="small${locked ? '' : ' primary'}" data-buyroom="${a.kind}" ${locked || me!.coins < a.price ? 'disabled' : ''}>${locked ? `🔒 Lv ${a.level}` : `Køb · ${a.price} ${COIN}`}</button></div>`;
        })
        .join('')}</div>`
    : '';
  openPanel(
    'nav',
    head('🧭 Navigator', 'Gå på opdagelse i hotellet.') +
      search +
      (navQuery || navTab !== 'popular' ? '' : apt) +
      (pub.length
        ? `<h3>Offentlige rum</h3><div class="list">${pub.map(row).join('')}</div>`
        : '') +
      `<h3>${navQuery ? `Søgning: “${esc(navQuery)}”` : navTab === 'popular' ? '🔥 Værelser lige nu' : 'Værelser'}</h3><div class="list">${
        guest.map(row).join('') ||
        `<p class="sub">${navQuery ? 'Ingen rum passer til din søgning.' : navTab === 'fav' ? 'Tryk ☆ ved et rum for at gemme det her.' : navTab === 'popular' ? 'Ingen værelser med gæster lige nu.' : 'Ingen rum i denne kategori endnu – ejere vælger kategori under "Dit værelse".'}</p>${navTab !== 'popular' || navQuery ? '<button class="small" id="navAll">← Vis populære rum</button>' : ''}`
      }</div>` +
      `<h3>📅 Ugens events</h3><p class="sub">${EVENTS.map((e) => `${e.name}: ${WEEKDAYS[e.weekday]} kl. ${e.start}–${e.end}`).join('<br>')}<br>Dobbelt mønter og et særligt badge, hvis du er med i 5 minutter.</p>` +
      own,
  );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-go]')
    .forEach((b) => b.addEventListener('click', () => goTo(b.dataset.go!)));
  $('panel')
    .querySelectorAll<HTMLElement>('[data-fav]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        net?.send({ t: 'favorite', roomId: b.dataset.fav!, on: !b.classList.contains('on') });
        if (navQuery || navTab !== 'popular') net?.send(navRequest());
      }),
    );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-tab]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        navTab = b.dataset.tab as NavTab;
        renderNavigator(rooms);
        // A category shows every open room in it, not only the busy ones.
        net?.send(navRequest());
      }),
    );
  $('navAll')?.addEventListener('click', () => {
    navTab = 'popular';
    navQuery = '';
    net?.send(navRequest());
    renderNavigator(rooms);
  });
  const q = $<HTMLInputElement>('navQ');
  q.addEventListener('input', () => {
    clearTimeout(navSearchTimer);
    navSearchTimer = window.setTimeout(() => {
      navQuery = q.value.trim();
      net?.send(navRequest());
    }, 300);
  });
  if (navQuery) {
    q.focus();
    q.setSelectionRange(q.value.length, q.value.length);
  }
  $('panel')
    .querySelectorAll<HTMLElement>('[data-buyroom]')
    .forEach((b) =>
      b.addEventListener('click', () =>
        net?.send({ t: 'buyRoom', kind: b.dataset.buyroom as 'bedroom' }),
      ),
    );
  if (own && room) {
    $<HTMLSelectElement>('rsAccess').value = room.access;
    $<HTMLSelectElement>('rsCat').value = room.category;
    $('rsRenovate').addEventListener('click', () => {
      reno = { size: room!.size, shape: room!.shape };
      renderRenovate();
    });
    $('rsSave').addEventListener('click', () => {
      const pw = $<HTMLInputElement>('rsPw').value;
      net?.send({
        t: 'roomSettings',
        name: $<HTMLInputElement>('rsName').value.trim() || undefined,
        description: $<HTMLInputElement>('rsDesc').value,
        access: $<HTMLSelectElement>('rsAccess').value as RoomView['access'],
        category: $<HTMLSelectElement>('rsCat').value as RoomCategory,
        password: pw.length >= 3 ? pw : undefined,
      });
    });
  }
}

let reno: { size: number; shape: RoomShape } = { size: ROOM_SIZE, shape: 'square' };
/** Little map of a floor plan made of squares. */
function floorPreview(size: number, shape: RoomShape, px = 6) {
  let cells = '';
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++)
      cells += `<i class="${isFloorTile({ size, shape }, x, z) ? 'f' : ''}"></i>`;
  return `<div class="fplan" style="grid-template-columns:repeat(${size},${px}px);grid-auto-rows:${px}px">${cells}</div>`;
}
function renderRenovate() {
  if (!me || !room || !isOwner()) return;
  const lv = levelOf(me).level;
  const paid = room.paidSize;
  const sizes = Object.keys(SIZE_PRICES)
    .map(Number)
    .map((n) => {
      const t = SIZE_PRICES[n]!;
      const locked = n > paid && lv < t.minLevel;
      const price = renovationPrice(paid, n);
      return `<button class="${reno.size === n ? 'on' : ''}" data-size="${n}" ${locked ? 'disabled' : ''}>${n}×${n}${locked ? ` · 🔒 lv ${t.minLevel}` : price ? ` · ${price} ${COIN}` : ''}</button>`;
    })
    .join('');
  const shapes = ROOM_SHAPE_IDS.map(
    (id) =>
      `<button class="shapebtn${reno.shape === id ? ' on' : ''}" data-shape="${id}">${floorPreview(reno.size, id, 5)}<span>${ROOM_SHAPES[id].name}</span></button>`,
  ).join('');
  const price = renovationPrice(paid, reno.size);
  const same = reno.size === room.size && reno.shape === room.shape;
  openPanel(
    'renovate',
    head(
      '📐 Byg om',
      'Vælg størrelse og gulvplan for dit rum. Mindre størrelser er altid gratis.',
    ) +
      `<h3>Størrelse</h3><div class="chips">${sizes}</div>
       <h3>Form</h3><div class="shapes">${shapes}</div>
       <h3>Sådan bliver det</h3><div style="display:flex;gap:14px;align-items:center">${floorPreview(reno.size, reno.shape, 12)}
       <p class="sub">${floorTileCount({ size: reno.size, shape: reno.shape })} felter. Møbler, der ikke passer i den nye form, lægges i dit inventar. ${paid > ROOM_SIZE ? `Du har betalt op til ${paid}×${paid}.` : ''}</p></div>
       <p style="margin-top:10px"><button id="renoGo" class="primary" ${same || me.coins < price ? 'disabled' : ''}>${price ? `Byg om for ${price} ${COIN}` : 'Byg om (gratis)'}</button> <button id="renoBack" class="small">← Tilbage</button></p>`,
  );
  const p = $('panel');
  p.querySelectorAll<HTMLElement>('[data-size]').forEach((b) =>
    b.addEventListener('click', () => {
      reno.size = Number(b.dataset.size);
      renderRenovate();
    }),
  );
  p.querySelectorAll<HTMLElement>('[data-shape]').forEach((b) =>
    b.addEventListener('click', () => {
      reno.shape = b.dataset.shape as RoomShape;
      renderRenovate();
    }),
  );
  $('renoGo').addEventListener('click', () => {
    net?.send({ t: 'renovate', size: reno.size, shape: reno.shape });
    closePanel();
  });
  $('renoBack').addEventListener('click', () => openNavigator());
}

/** Shop: tab (department, 'all', 'decor' or 'inv') and search text. */
let shopTab = 'all';
let shopQuery = '';
function renderShop() {
  if (!me) return;
  const list = FURNITURE_TYPES.filter((k) => !furniture(k).noShop);
  const card = (k: FurnitureType) => {
    const c = FURNITURE[k] as FurnitureDef;
    const lvLocked = !!c.minLevel && levelOf(me!).level < c.minLevel;
    const locked = (!!c.unlock && !me!.badges.includes(c.unlock)) || lvLocked;
    const dots = c.colors
      ? `<div class="dots">${c.colors
          .slice(0, 6)
          .map((col) => `<i style="background:#${col.toString(16).padStart(6, '0')}"></i>`)
          .join('')}</div>`
      : '';
    const btn = locked
      ? `<button disabled>🔒 ${lvLocked ? `Level ${c.minLevel}` : esc(BADGES[c.unlock!].icon + ' ' + BADGES[c.unlock!].name)}</button>`
      : `<button data-buy="${k}" ${me!.coins < c.price ? 'disabled' : ''}>Køb</button>`;
    return `<div class="item${locked ? ' locked' : ''}"><div class="ic">${c.icon}</div><div class="n">${c.name}</div><div class="p">${c.price} ${COIN} · ${c.w}×${c.d}</div>${dots}${btn}</div>`;
  };
  const inv = me.inventory;
  const invHtml = inv.length
    ? `<div class="grid">${inv
        .map((it, i) => {
          const c = FURNITURE[it.type];
          return `<div class="item"><div class="ic">${c.icon}</div><div class="n">${c.name}</div><button data-inv="${i}">Placér</button></div>`;
        })
        .join('')}</div>`
    : '<p class="sub">Dit inventar er tomt. Gem møbler væk med 📦 i byggetilstand.</p>';
  // Unlocked things first, then by price.
  const lv = levelOf(me).level;
  const isLocked = (k: FurnitureType) => {
    const c = FURNITURE[k] as FurnitureDef;
    return (!!c.unlock && !me!.badges.includes(c.unlock)) || (!!c.minLevel && lv < c.minLevel);
  };
  const sorted = (ks: readonly FurnitureType[]) =>
    ks
      .filter((k) => list.includes(k))
      .sort(
        (a, b) =>
          Number(isLocked(a)) - Number(isLocked(b)) ||
          (FURNITURE[a] as FurnitureDef).price - (FURNITURE[b] as FurnitureDef).price,
      );
  const q = shopQuery.trim().toLowerCase();
  let body: string;
  if (q) {
    const hits = sorted(list.filter((k) => FURNITURE[k].name.toLowerCase().includes(q)));
    body = hits.length
      ? `<h3>🔍 ${hits.length} fundet</h3><div class="grid">${hits.map(card).join('')}</div>`
      : `<p class="sub">Ingen møbler hedder noget med “${esc(shopQuery)}”.</p>`;
  } else if (shopTab === 'inv') body = `<h3>📦 Dit inventar</h3>${invHtml}`;
  else if (shopTab === 'decor') body = decorShop();
  else {
    const cats =
      shopTab === 'all' ? SHOP_CATEGORIES : SHOP_CATEGORIES.filter((c) => c.id === shopTab);
    body = cats
      .map(
        (c) =>
          `<h3>${c.icon} ${c.name}</h3>${c.id === 'wall' ? '<p class="sub">Peg på væggen (eller gulvet tæt ved den) for at hænge op · R skifter væg</p>' : ''}<div class="grid">${sorted(c.types).map(card).join('')}</div>`,
      )
      .join('');
  }
  const tab = (id: string, label: string) =>
    `<button class="${shopTab === id && !q ? 'on' : ''}" data-stab="${id}">${label}</button>`;
  const tabs = [
    tab('all', '✨ Alle'),
    ...SHOP_CATEGORIES.map((c) => tab(c.id, `${c.icon} ${c.name}`)),
    tab('decor', '🎨 Tapet og gulv'),
    tab('inv', `📦 Inventar${inv.length ? ` (${inv.length})` : ''}`),
  ].join('');
  openPanel(
    'shop',
    head(
      '🛒 Møbelbutikken',
      'Køb med mønter. Møblet ryger direkte ind på dit værelse. Tryk 🎨 (eller F) for at vælge farve.',
    ) +
      `<div class="row"><input id="shopQ" maxlength="30" placeholder="🔍 Søg efter et møbel…" value="${esc(shopQuery)}" style="width:100%"></div>
       <div class="chips navtabs">${tabs}</div>${body}`,
  );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-stab]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        shopTab = b.dataset.stab!;
        shopQuery = '';
        renderShop();
      }),
    );
  const sq = $<HTMLInputElement>('shopQ');
  sq.addEventListener('input', () => {
    shopQuery = sq.value;
    renderShop();
  });
  if (shopQuery) {
    sq.focus();
    sq.setSelectionRange(sq.value.length, sq.value.length);
  }
  $('panel')
    .querySelectorAll<HTMLElement>('[data-buy]')
    .forEach((b) => b.addEventListener('click', () => startBuy(b.dataset.buy as FurnitureType)));
  $('panel')
    .querySelectorAll<HTMLElement>('[data-decor]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        const [kind, id] = b.dataset.decor!.split(':') as ['wall' | 'floor', string];
        net?.send({ t: 'decor', kind, id: id === '-' ? null : id });
      }),
    );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-inv]')
    .forEach((b) => b.addEventListener('click', () => startPlaceInv(Number(b.dataset.inv))));
}

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
/** Wallpaper and floor cards; buying one also puts it up in the room you are in. */
function decorShop() {
  if (!me || !room) return '';
  if (room.ownerId !== me.id)
    return '<h3>🎨 Tapet og gulv</h3><p class="sub">Gå ind i et af dine egne rum for at skifte tapet og gulv.</p>';
  const lv = levelOf(me).level;
  const card = (
    kind: 'wall' | 'floor',
    id: string,
    def: { name: string; price: number; minLevel?: number },
    swatch: string,
  ) => {
    const owned = me!.decor.includes(`${kind}:${id}`);
    const using = (kind === 'wall' ? room!.wall : room!.floor) === id;
    const locked = !owned && !!def.minLevel && lv < def.minLevel;
    const btn = using
      ? '<button disabled>✓ I brug</button>'
      : locked
        ? `<button disabled>🔒 Level ${def.minLevel}</button>`
        : owned
          ? `<button data-decor="${kind}:${id}">Brug</button>`
          : `<button data-decor="${kind}:${id}" ${me!.coins < def.price ? 'disabled' : ''}>Køb</button>`;
    return `<div class="item${locked ? ' locked' : ''}"><div class="swatch" style="${swatch}"></div><div class="n">${esc(def.name)}</div><div class="p">${owned ? 'Ejet' : `${def.price} ${COIN}`}</div>${btn}</div>`;
  };
  const walls = Object.entries(WALLPAPERS).map(([id, d]) =>
    card(
      'wall',
      id,
      d,
      `background:repeating-linear-gradient(90deg,${d.base} 0 10px,${d.stripe} 10px 18px)`,
    ),
  );
  const floors = Object.entries(FLOORS).map(([id, d]) =>
    card(
      'floor',
      id,
      d,
      `background:repeating-conic-gradient(${hex(d.a)} 0 25%,${hex(d.b)} 0 50%) 0 0/24px 24px`,
    ),
  );
  return `<h3>🎨 Tapet</h3><p class="sub">Køb én gang – brug det i alle dine rum. <button class="small" data-decor="wall:-">Standard</button></p><div class="grid">${walls.join('')}</div>
    <h3>🟫 Gulv</h3><p class="sub"><button class="small" data-decor="floor:-">Standard</button></p><div class="grid">${floors.join('')}</div>`;
}

let petPick: { kind: PetKind; color: number } = { kind: 'hund', color: 0 };
function renderPets() {
  if (!me) return;
  const lv = levelOf(me).level;
  const now = net ? net.now() : Date.now();
  const mine = me.pets
    .map((p) => {
      const k = PET_KINDS[p.kind];
      const next = petXpFor(p.level + 1);
      const prev = petXpFor(p.level);
      const pct =
        p.level >= PET_MAX_LEVEL ? 100 : Math.round(((p.xp - prev) / (next - prev)) * 100);
      const out = me!.activePet === p.id;
      const feedWait = p.feedAt > now ? Math.ceil((p.feedAt - now) / 60000) : 0;
      const tricks = PET_TRICK_IDS.map((t) => {
        const d = PET_TRICKS[t];
        return p.level >= d.level
          ? `<button class="small" data-trick="${t}" ${out ? '' : 'disabled'}>${d.icon} ${d.name}</button>`
          : `<button class="small" disabled title="Level ${d.level}">🔒 ${d.name} (lv ${d.level})</button>`;
      }).join('');
      return `<div class="petcard${out ? ' out' : ''}">
        <div class="row" style="display:flex;align-items:center;gap:8px"><b style="font-size:18px">${k.icon} ${esc(p.name)}</b><span class="lvtag">Lv ${p.level}</span>${p.hungry ? '<span class="hungry">😿 Sulten</span>' : ''}<span style="flex:1"></span>
        ${out ? `<button class="small" data-home="1">🏠 Send hjem</button>` : `<button class="small primary" data-out="${p.id}">🐾 Tag med</button>`}</div>
        <div class="xpbar"><i style="width:${pct}%"></i></div>
        <p class="sub">${p.xp} XP${p.level < PET_MAX_LEVEL ? ` · ${next - p.xp} til level ${p.level + 1}` : ' · max level'}. Mad giver ${PET_FEED_XP} XP, tricks ${PET_TRICK_XP} XP.</p>
        ${out ? `<div class="chips"><button class="small" data-feed="1" ${feedWait || me!.coins < PET_FEED_PRICE ? 'disabled' : ''}>🍖 Giv mad (${PET_FEED_PRICE} ${COIN})${feedWait ? ` · om ${feedWait} min` : ''}</button>${tricks}</div>` : ''}
        <div style="display:flex;gap:6px;margin-top:8px"><input data-name="${p.id}" maxlength="14" value="${esc(p.name)}" style="flex:1"><button class="small" data-rename="${p.id}">Omdøb</button></div>
      </div>`;
    })
    .join('');
  const kinds = PET_KIND_IDS.map((id) => {
    const k = PET_KINDS[id] as PetKindDef;
    const locked = !!k.minLevel && lv < k.minLevel;
    return `<button class="chip${petPick.kind === id ? ' on' : ''}" data-kind="${id}" ${locked ? 'disabled' : ''}>${k.icon} ${k.name} · ${k.price} ${COIN}${locked ? ` · 🔒 lv ${k.minLevel}` : ''}</button>`;
  }).join('');
  const pk = PET_KINDS[petPick.kind] as PetKindDef;
  const colors = pk.colors
    .map(
      (c, i) =>
        `<button class="swatchbtn${petPick.color === i ? ' on' : ''}" data-pcol="${i}" style="background:#${c.toString(16).padStart(6, '0')}"></button>`,
    )
    .join('');
  const full = me.pets.length >= PET_MAX;
  openPanel(
    'pets',
    head(
      '🐾 Kæledyr',
      'Dit kæledyr følger dig rundt i hotellet. Sig dets navn i chatten, så svarer det.',
    ) +
      (mine || '<p class="sub">Du har ikke noget kæledyr endnu.</p>') +
      (full
        ? `<p class="sub">Du har ${PET_MAX} kæledyr – det er max.</p>`
        : `<h3>🛒 Køb et kæledyr</h3><div class="chips">${kinds}</div>
           <div class="chips" style="margin-top:8px">${colors}</div>
           <div style="display:flex;gap:6px;margin-top:8px"><input id="petName" maxlength="14" placeholder="Navn" value="${esc(pk.defaultName)}" style="flex:1"><button id="petBuy" class="primary" ${me.coins < pk.price ? 'disabled' : ''}>Køb for ${pk.price} ${COIN}</button></div>`),
  );
  const p = $('panel');
  const on = (sel: string, f: (el: HTMLElement) => void) =>
    p.querySelectorAll<HTMLElement>(sel).forEach((b) => b.addEventListener('click', () => f(b)));
  on('[data-out]', (b) => net?.send({ t: 'petOut', id: b.dataset.out! }));
  on('[data-home]', () => net?.send({ t: 'petOut', id: null }));
  on('[data-feed]', () => net?.send({ t: 'petFeed' }));
  on('[data-trick]', (b) => net?.send({ t: 'petTrick', trick: b.dataset.trick as PetTrick }));
  on('[data-rename]', (b) => {
    const v = p.querySelector<HTMLInputElement>(`[data-name="${b.dataset.rename}"]`)!.value.trim();
    net?.send({ t: 'petRename', id: b.dataset.rename!, name: v });
  });
  on('[data-kind]', (b) => {
    petPick = { kind: b.dataset.kind as PetKind, color: 0 };
    renderPets();
  });
  on('[data-pcol]', (b) => {
    petPick.color = Number(b.dataset.pcol);
    renderPets();
  });
  $('petBuy')?.addEventListener('click', () => {
    const name = $<HTMLInputElement>('petName').value.trim();
    if (name.length < 2) return toast('Giv dit kæledyr et navn', 'error');
    net?.send({ t: 'buyPet', kind: petPick.kind, name, color: petPick.color });
  });
}

let market: { listings: MarketListing[]; mine: MarketListing[] } | null = null;
let marketQ = '';
let marketTimer = 0;
function openMarket() {
  renderMarket();
  net?.send({ t: 'market', q: marketQ || undefined });
}
function renderMarket() {
  if (!me) return;
  const card = (l: MarketListing, own: boolean) => {
    const c = FURNITURE[l.item.type] as FurnitureDef;
    const col = c.colors?.[l.item.color ?? 0];
    return `<div class="item mk"><div class="ic">${c.icon}</div><div class="n">${esc(c.name)}</div>
      ${col !== undefined ? `<div class="dots"><i style="background:#${col.toString(16).padStart(6, '0')}"></i></div>` : ''}
      <div class="p">${l.price} ${COIN}</div><small class="sub">${own ? 'Din vare' : `Af ${esc(l.sellerName)}`}</small>
      ${own ? `<button data-mcancel="${esc(l.id)}">Tag tilbage</button>` : `<button data-mbuy="${esc(l.id)}" ${me!.coins < l.price ? 'disabled' : ''}>Køb</button>`}</div>`;
  };
  const inv = me.inventory;
  const sell = inv.length
    ? `<div class="row" style="display:flex;gap:6px;flex-wrap:wrap"><select id="mkItem" style="flex:1">${inv
        .map(
          (it, i) =>
            `<option value="${i}">${FURNITURE[it.type].icon} ${esc(FURNITURE[it.type].name)}</option>`,
        )
        .join(
          '',
        )}</select><input id="mkPrice" type="number" min="1" max="${MARKET_MAX_PRICE}" value="10" style="width:90px"><button id="mkSell" class="small primary">Sæt til salg</button></div>
       <p class="sub">Hutel tager ${Math.round(MARKET_FEE * 100)} % af salgsprisen. Du får mønterne, også selvom du er offline.</p>`
    : '<p class="sub">Dit inventar er tomt. Gem møbler væk (📦 i byggetilstand) for at kunne sælge dem.</p>';
  openPanel(
    'market',
    head('🏪 Markedet', 'Køb og sælg møbler med andre gæster.') +
      `<div class="row"><input id="mkQ" maxlength="30" placeholder="🔍 Søg efter møbel eller sælger…" value="${esc(marketQ)}" style="width:100%"></div>` +
      `<h3>Til salg</h3><div class="grid">${market ? market.listings.map((l) => card(l, false)).join('') || '<p class="sub">Ingen varer lige nu.</p>' : '<p class="sub">Henter…</p>'}</div>` +
      `<h3>💰 Sælg noget</h3>${sell}` +
      (market?.mine.length
        ? `<h3>Dine varer (${market.mine.length}/${MARKET_MAX_LISTINGS})</h3><div class="grid">${market.mine.map((l) => card(l, true)).join('')}</div>`
        : ''),
  );
  const p = $('panel');
  p.querySelectorAll<HTMLElement>('[data-mbuy]').forEach((b) =>
    b.addEventListener('click', () => net?.send({ t: 'marketBuy', id: b.dataset.mbuy! })),
  );
  p.querySelectorAll<HTMLElement>('[data-mcancel]').forEach((b) =>
    b.addEventListener('click', () => net?.send({ t: 'marketCancel', id: b.dataset.mcancel! })),
  );
  $('mkSell')?.addEventListener('click', () => {
    const price = Math.round(Number($<HTMLInputElement>('mkPrice').value));
    if (!(price >= 1 && price <= MARKET_MAX_PRICE)) return toast('Vælg en pris', 'error');
    net?.send({ t: 'marketSell', index: Number($<HTMLSelectElement>('mkItem').value), price });
  });
  const q = $<HTMLInputElement>('mkQ');
  q.addEventListener('input', () => {
    clearTimeout(marketTimer);
    marketTimer = window.setTimeout(() => {
      marketQ = q.value.trim();
      net?.send({ t: 'market', q: marketQ || undefined });
    }, 300);
  });
  if (marketQ) {
    q.focus();
    q.setSelectionRange(q.value.length, q.value.length);
  }
}

/** Choose a game at a game console. */
let roomNotes: RoomNote[] = [];
let notesMod = false;
let noteColor = 0;

/** 😊 Actions and emotes. */
function renderMoves() {
  const a = myActor();
  openPanel(
    'moves',
    head('😊 Handlinger', 'Tip: skriv også :sit, :kram, :sov, :heart eller :shout hej i chatten.') +
      `<h3>Gør noget</h3><div class="chips">${ACTION_IDS.map((k) => `<button data-act="${k}" class="${a?.action === k ? 'primary' : ''}">${ACTIONS[k].icon} ${ACTIONS[k].name}</button>`).join('')}<button data-act="stop">✋ Stop</button></div>
      ${a?.carry ? `<h3>I hånden</h3><div class="chips"><span style="font-size:22px">${CARRY[a.carry as CarryKind].icon}</span> ${CARRY[a.carry as CarryKind].name} <button data-drop>Læg den fra dig</button></div><p class="sub">Klik på en figur og vælg 🎁 Giv for at give den væk.</p>` : ''}
      <h3>Emotes</h3><div class="chips emotes">${EMOTE_IDS.map((k) => `<button data-emo="${k}" style="font-size:22px">${EMOTES[k]}</button>`).join('')}</div>`,
  );
  const p = $('panel');
  p.querySelectorAll<HTMLElement>('[data-act]').forEach((b) =>
    b.addEventListener('click', () => {
      net?.send({ t: 'action', kind: b.dataset.act as ActionKind | 'stop' });
      if (!ACTIONS[b.dataset.act as ActionKind]?.timed) setTimeout(renderMoves, 250);
    }),
  );
  p.querySelector('[data-drop]')?.addEventListener('click', () => net?.send({ t: 'carryDrop' }));
  p.querySelectorAll<HTMLElement>('[data-emo]').forEach((b) =>
    b.addEventListener('click', () => net?.send({ t: 'emote', kind: b.dataset.emo as EmoteKind })),
  );
}

/** Counter / machine: pick what you'd like to carry. */
function renderDispense(itemId: number, kinds: readonly CarryKind[]) {
  openPanel(
    'dispense',
    head('🍽️ Hvad skal det være?', 'Din figur går hen og henter det. Det er gratis 🙂') +
      `<div class="chips">${kinds.map((k) => `<button data-carry="${k}" style="font-size:16px">${CARRY[k].icon} ${CARRY[k].name}</button>`).join('')}</div>`,
  );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-carry]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        net?.send({ t: 'dispense', itemId, kind: b.dataset.carry as CarryKind });
        closePanel();
      }),
    );
}

/** 📌 Notice board with post-its; the owner approves notes from guests. */
function openNotes() {
  roomNotes = [];
  renderNotes();
  net?.send({ t: 'notes' });
}
function renderNotes() {
  const card = (n: RoomNote) =>
    `<div class="postit" style="background:${NOTE_COLORS[n.color] ?? NOTE_COLORS[0]}"><p>${esc(n.text)}</p><small>– ${esc(n.fromName)}${n.approved ? '' : ' · ⏳ venter'}</small>
      ${notesMod && !n.approved ? `<button class="small primary" data-napp="${n.id}">✅ Godkend</button>` : ''}
      ${notesMod || n.fromId === me?.id ? `<button class="small" data-ndel="${n.id}">🗑</button>` : ''}</div>`;
  const waiting = roomNotes.filter((n) => !n.approved);
  const shown = roomNotes.filter((n) => n.approved);
  openPanel(
    'notes',
    head(
      '📌 Opslagstavle',
      notesMod
        ? 'Gæsternes sedler kommer først op, når du har godkendt dem.'
        : 'Skriv en seddel – ejeren af rummet godkender den.',
    ) +
      `<div class="row"><textarea id="noteText" rows="2" maxlength="${NOTE_MAX_LENGTH}" placeholder="Skriv en hilsen…" style="width:100%"></textarea></div>
      <div class="chips">${NOTE_COLORS.map((c, i) => `<button data-ncol="${i}" style="background:${c};width:34px;height:30px;${i === noteColor ? 'outline:3px solid #ffb347' : ''}"></button>`).join('')}<button id="noteSend" class="primary">📌 Sæt op</button></div>` +
      (waiting.length
        ? `<h3>${notesMod ? 'Venter på godkendelse' : 'Dine sedler der venter'}</h3><div class="postits">${waiting.map(card).join('')}</div>`
        : '') +
      `<h3>På tavlen</h3><div class="postits">${shown.map(card).join('') || '<p class="sub">Ingen sedler endnu.</p>'}</div>`,
  );
  const p = $('panel');
  p.querySelectorAll<HTMLElement>('[data-ncol]').forEach((b) =>
    b.addEventListener('click', () => {
      noteColor = Number(b.dataset.ncol);
      const keep = $<HTMLTextAreaElement>('noteText').value;
      renderNotes();
      $<HTMLTextAreaElement>('noteText').value = keep;
    }),
  );
  $('noteSend').addEventListener('click', () => {
    const text = $<HTMLTextAreaElement>('noteText').value.trim();
    if (text) net?.send({ t: 'noteWrite', text, color: noteColor });
  });
  p.querySelectorAll<HTMLElement>('[data-napp]').forEach((b) =>
    b.addEventListener('click', () => net?.send({ t: 'noteApprove', id: b.dataset.napp! })),
  );
  p.querySelectorAll<HTMLElement>('[data-ndel]').forEach((b) =>
    b.addEventListener('click', () => net?.send({ t: 'noteDelete', id: b.dataset.ndel! })),
  );
}

/** Jukebox: choose a tune that everyone in the room hears in sync. */
function renderJukebox(itemId: number) {
  const it = items.get(itemId);
  if (!it) return;
  const mayPick = room?.canBuild || me?.role !== 'user';
  openPanel(
    'jukebox',
    head(
      '📻 Jukebox',
      mayPick
        ? 'Vælg en melodi – alle i rummet hører den samtidig.'
        : 'Kun ejeren kan vælge musik her.',
    ) +
      MELODY_IDS.map((id) => {
        const m = MELODIES[id];
        const playing = it.song === id;
        return `<button class="${playing ? 'primary' : ''}" data-song="${id}" ${mayPick ? '' : 'disabled'} style="display:block;width:100%;margin:6px 0;text-align:left">${m.icon} ${esc(m.name)} <span class="sub">· ${m.bpm} bpm</span>${playing ? ' ▶︎' : ''}</button>`;
      }).join('') +
      (it.song && mayPick ? '<button data-song="">⏹ Stop musikken</button>' : '') +
      (audio.settings.music
        ? ''
        : '<p class="sub">🔇 Musik er slået fra i dine lydindstillinger (🔊).</p>'),
  );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-song]')
    .forEach((b) =>
      b.addEventListener('click', () =>
        net?.send({ t: 'jukebox', itemId, song: b.dataset.song || null }),
      ),
    );
}

/** Jukeboxes get quieter the further away you stand. */
function updateJukeboxVolumes() {
  const a = myActor();
  for (const id of audio.jukeboxIds()) {
    const o = objs.get(id);
    if (!o || !a) {
      audio.setJukeboxVolume(id, 0.6);
      continue;
    }
    const d = Math.hypot(o.position.x - a.obj.position.x, o.position.z - a.obj.position.z);
    audio.setJukeboxVolume(id, Math.max(0.12, Math.min(1, 1.25 - d / 8)));
  }
}

/** 🔊 Sound settings, saved in this browser. */
function renderSound() {
  const s = audio.settings;
  openPanel(
    'sound',
    head('🔊 Lyd', 'Alle lyde er lavet i kode. Indstillingerne gemmes i denne browser.') +
      `<label class="sub" style="display:block;margin:10px 0">Lydstyrke <input id="sndVol" type="range" min="0" max="100" value="${Math.round(s.volume * 100)}" style="width:100%"></label>
      <label style="display:block;margin:8px 0"><input id="sndSfx" type="checkbox" ${s.sfx ? 'checked' : ''}> Lydeffekter (klik, mønter, døre, chat)</label>
      <label style="display:block;margin:8px 0"><input id="sndMusic" type="checkbox" ${s.music ? 'checked' : ''}> Musik fra jukebokse</label>
      <button id="sndTest">▶︎ Prøv en lyd</button>`,
  );
  ($('sndVol') as HTMLInputElement).addEventListener('input', (e) =>
    audio.saveSettings({ volume: Number((e.target as HTMLInputElement).value) / 100 }),
  );
  ($('sndSfx') as HTMLInputElement).addEventListener('change', (e) =>
    audio.saveSettings({ sfx: (e.target as HTMLInputElement).checked }),
  );
  ($('sndMusic') as HTMLInputElement).addEventListener('change', (e) =>
    audio.saveSettings({ music: (e.target as HTMLInputElement).checked }),
  );
  $('sndTest').addEventListener('click', () => audio.sfx('coin'));
  updateSoundIcon();
}
function updateSoundIcon() {
  const s = audio.settings;
  $('bSound').textContent = s.volume === 0 || (!s.sfx && !s.music) ? '🔇' : '🔊';
}

function renderGames(itemId: number) {
  const count = (t: string) => [...items.values()].filter((i) => i.type === t).length;
  const ok = {
    paint: count('colortile') >= 4,
    race: count('racestart') > 0 && count('racegoal') > 0,
  } as const;
  const busy = !!room?.game;
  openPanel(
    'game',
    head('🕹️ Spilkonsol', 'Start et spil for alle i rummet. Serveren holder styr på reglerne.') +
      ROOM_GAME_IDS.map((k) => {
        const g = ROOM_GAMES[k];
        return `<div class="petcard"><b style="font-size:17px">${g.icon} ${g.name}</b> <span class="sub">· ${g.secs} sek · vinderen får ${g.reward} ${COIN}</span>
          <p class="sub">${g.rules}</p>
          <p class="sub">Kræver: ${g.needs.toLowerCase()} ${ok[k] ? '✅' : '❌ (køb dem i butikken)'}</p>
          <button class="primary" data-game="${k}" ${ok[k] && !busy ? '' : 'disabled'}>${busy ? 'Et spil er i gang' : 'Start'}</button>
          <button data-tut="${k}">▶︎ Se hvordan det virker</button></div>`;
      }).join('') +
      '<p class="sub">Mønter gives kun, når mindst to spiller med (højst 20 om dagen fra spil).</p>',
  );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-game]')
    .forEach((b) =>
      b.addEventListener('click', () =>
        net?.send({ t: 'gameStart', itemId, kind: b.dataset.game as RoomGameKind }),
      ),
    );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-tut]')
    .forEach((b) =>
      b.addEventListener('click', () => renderTutorial(itemId, b.dataset.tut as RoomGameKind)),
    );
}

/** A short animated film that shows how a room game is set up and played. */
function renderTutorial(itemId: number, kind: RoomGameKind) {
  const g = ROOM_GAMES[kind];
  openPanel(
    'tutorial',
    head(`${g.icon} Sådan spiller man ${g.name}`, g.rules) +
      `<canvas id="tutCanvas" style="display:block;border-radius:12px;background:rgba(0,0,0,.25);margin:8px 0"></canvas>
      <p id="tutCap" style="min-height:44px;font-size:15px;margin:6px 0"></p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="tutPause">⏸ Pause</button>
        <button id="tutAgain">↺ Forfra</button>
        <button id="tutBack" class="primary">← Tilbage til konsollen</button>
      </div>`,
  );
  const film = playTutorial($('tutCanvas') as HTMLCanvasElement, kind, (text, step, total) => {
    $('tutCap').textContent = `${text}  (${step}/${total})`;
  });
  stopTutorial = film.stop;
  $('tutPause').addEventListener('click', () => {
    $('tutPause').textContent = film.toggle() ? '▶︎ Afspil' : '⏸ Pause';
  });
  $('tutAgain').addEventListener('click', () => film.restart());
  $('tutBack').addEventListener('click', () => renderGames(itemId));
}

/** Score and clock for the game in this room (updated a few times a second). */
function updateGameBar() {
  const bar = $('gameBar');
  const g = room?.game;
  if (!g) {
    bar.classList.add('hidden');
    return;
  }
  const def = ROOM_GAMES[g.kind];
  const left = Math.max(0, Math.ceil((g.until - (net ? net.now() : Date.now())) / 1000));
  const clock =
    g.phase === 'countdown'
      ? `Starter om ${left}…`
      : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  let mid = '';
  if (g.kind === 'paint' && g.score) {
    const team = me && g.teams?.[me.id];
    mid = `<b style="color:#ff8a7a">🔴 ${g.score[0]}</b> – <b style="color:#8ab8ff">🔵 ${g.score[1]}</b>${team ? ` · du er ${TEAM_NAMES[team]}` : ''}`;
  } else if (g.kind === 'race') {
    mid =
      me && g.racers?.includes(me.id)
        ? 'Du er med – løb mod 🏁!'
        : `${g.racers?.length ?? 0} løbere`;
  }
  bar.innerHTML = `<b>${def.icon} ${def.name}</b><span>${mid}</span><span class="sub">${clock}</span>`;
  bar.classList.remove('hidden');
}
setInterval(() => {
  if (room?.game) updateGameBar();
}, 250);

function levelBox() {
  if (!me) return '';
  const l = levelOf(me);
  const pct = Math.round(((l.xp - l.prev) / (l.next - l.prev)) * 100);
  return `<h3>⭐ Level ${l.level}</h3><div class="xpbar"><i style="width:${pct}%"></i></div><p class="sub">${l.xp} XP · ${l.next - l.xp} XP til level ${l.level + 1}. Du får XP for tid på hotellet (1 pr. minut), opgaver (10) og badges (20).</p>`;
}
let confirmReset = false;
let wearAfterBuy: string | null = null;
function renderFigure() {
  if (!me) return;
  openPanel(
    'fig',
    head('🧍 Min figur', 'Køb sejt tøj med dine mønter – nogle ting låses op med badges.') +
      `<div class="row"><label>Motto</label><input id="motto" maxlength="60" value="${esc(me.motto)}" style="width:100%"></div><div id="lookEd"></div>
    ${levelBox()}
    <h3>👕 Gemte outfits</h3><div class="outfits">${Array.from({ length: OUTFIT_SLOTS }, (_, i) => {
      const o = me!.outfits?.[i];
      return `<div class="outfit"><b>${i + 1}</b>${o ? `<button class="small primary" data-owear="${i}">Tag på</button>` : '<span class="sub">tom</span>'}<button class="small" data-osave="${i}">Gem</button></div>`;
    }).join('')}</div>
    <h3>✨ Effekt</h3><div class="chips">${EFFECT_IDS.map((id) => {
      const e = EFFECTS[id] as {
        name: string;
        icon: string;
        badge?: keyof typeof BADGES;
        level?: number;
        duringEvents?: boolean;
      };
      const open = effectUnlocked(id, me!.badges, levelOf(me!).level, eventsRunning());
      const cur = (me!.effect ?? 'none') === id;
      const why = e.badge
        ? `badget ${BADGES[e.badge].name}${e.duringEvents ? ' (eller under events)' : ''}`
        : `level ${e.level}`;
      return `<button data-fx="${id}" ${open ? '' : 'disabled'} class="${cur ? 'on' : ''}" title="${open ? '' : 'Låses op med ' + esc(why)}">${open ? e.icon : '🔒'} ${esc(e.name)}</button>`;
    }).join('')}</div>
    <h3>💬 Chatboble</h3><div class="chips">${BUBBLE_STYLE_IDS.map((id) => {
      const st = BUBBLE_STYLES[id] as {
        name: string;
        bg: string;
        fg: string;
        badge?: keyof typeof BADGES;
        level?: number;
      };
      const open = bubbleUnlocked(id, me!.badges, levelOf(me!).level);
      const cur = (me!.bubble ?? 'classic') === id;
      const why = st.badge ? `badget ${BADGES[st.badge].name}` : `level ${st.level}`;
      return `<button data-bub="${id}" ${open ? '' : 'disabled'} title="${open ? '' : 'Låses op med ' + esc(why)}" style="background:${st.bg};color:${st.fg};${cur ? 'outline:3px solid #ffb347' : ''}">${open ? '' : '🔒 '}${esc(st.name)}</button>`;
    }).join('')}</div>
    <h3>Mine badges</h3><div class="badges">${me.badges.map((b) => `<span class="badge" title="${esc(BADGES[b].text)}">${BADGES[b].icon} ${BADGES[b].name}</span>`).join('')}</div>
    <h3>Konto</h3><button id="logout" class="small danger">Log ud på denne enhed</button>
    ${me.role !== 'user' ? `<button id="openAdmin" class="small">🛡️ Moderation</button>` : ''}
    ${canReset ? `<h3>Test</h3><p class="sub">Nulstil mønter, opgaver, badges og dit værelse, og prøv starten igen. Navn, figur og venner beholdes.</p><button id="resetMe" class="small danger">🔄 Start forfra</button>` : ''}`,
  );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-osave]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        if (!me) return;
        const i = Number(b.dataset.osave);
        me.outfits = [...(me.outfits ?? Array(OUTFIT_SLOTS).fill(null))];
        me.outfits[i] = { ...me.look };
        net?.send({ t: 'outfitSave', slot: i });
        renderFigure();
      }),
    );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-owear]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        const o = me?.outfits?.[Number(b.dataset.owear)];
        if (!me || !o) return;
        me.look = { ...o };
        net?.send({ t: 'outfitWear', slot: Number(b.dataset.owear) });
        renderFigure();
      }),
    );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-fx]')
    .forEach((b) =>
      b.addEventListener('click', () =>
        net?.send({ t: 'setEffect', effect: b.dataset.fx as EffectId }),
      ),
    );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-bub]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        if (!me) return;
        me.bubble = b.dataset.bub;
        net?.send({ t: 'setBubble', style: b.dataset.bub as never });
        renderFigure();
      }),
    );
  let lookT: number | undefined;
  lookEditor(
    $('lookEd'),
    me.look,
    (look) => {
      me!.look = look;
      myActor()?.setLook(look);
      clearTimeout(lookT);
      lookT = window.setTimeout(() => net?.send({ t: 'look', look }), 250);
    },
    {
      owned: me.wardrobe,
      badges: me.badges,
      coins: me.coins,
      onBuy: (key) => {
        wearAfterBuy = key;
        net?.send({ t: 'buyClothes', key });
      },
    },
  );
  $('motto').addEventListener('change', (e) => {
    me!.motto = (e.target as HTMLInputElement).value;
    net?.send({ t: 'motto', motto: me!.motto });
  });
  document
    .getElementById('openAdmin')
    ?.addEventListener('click', () => net?.send({ t: 'admin', action: 'reports' }));
  $('resetMe')?.addEventListener('click', () => {
    if (confirmReset) {
      net?.send({ t: 'reset' });
      return;
    }
    confirmReset = true;
    $('resetMe').textContent = 'Klik igen for at bekræfte';
    setTimeout(() => {
      confirmReset = false;
      const b = document.getElementById('resetMe');
      if (b) b.textContent = '🔄 Start forfra';
    }, 4000);
  });
  $('logout').addEventListener('click', () => {
    store.set(TOKEN_KEY, null);
    void signOut(authCfg).finally(() => location.reload());
  });
}

/* ---------------- moderation ---------------- */
function renderAdmin(reports: AdminReport[]) {
  const until = (t: number | null) =>
    t && t > Date.now()
      ? new Date(t).toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' })
      : '';
  const card = (r: AdminReport) => `<div class="li rep ${r.status}"><div class="grow">
      <b>${esc(r.target.name)}</b> <small>rapporteret af ${esc(r.from.name)} · ${new Date(r.createdAt).toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' })}${r.roomId ? ` · ${esc(r.roomId)}` : ''}</small>
      <p>“${esc(r.reason || 'Ingen begrundelse')}”</p>
      ${r.target.mutedUntil && r.target.mutedUntil > Date.now() ? `<small>🔇 På pause til ${until(r.target.mutedUntil)}</small> ` : ''}
      ${r.target.bannedUntil && r.target.bannedUntil > Date.now() ? `<small>⛔ Udelukket til ${until(r.target.bannedUntil)}</small>` : ''}
      ${r.context.length ? `<details><summary>Chat før rapporten (${r.context.length})</summary>${r.context.map((c) => `<div class="ctx"><b>${esc(c.name)}:</b> ${esc(c.text)}</div>`).join('')}</details>` : ''}
      <div class="chips">
        <button data-ad="warn" data-u="${r.target.id}">⚠️ Advar</button>
        <button data-ad="mute" data-u="${r.target.id}" data-m="60">🔇 Pause 1 t</button>
        <button data-ad="unmute" data-u="${r.target.id}">Fjern pause</button>
        <button data-ad="kick" data-u="${r.target.id}">🚪 Send hjem</button>
        <button data-ad="ban" data-u="${r.target.id}" data-m="10080" class="danger">⛔ Udeluk 7 dage</button>
        <button data-ad="unban" data-u="${r.target.id}">Ophæv</button>
        <button data-ad="resolve" data-r="${r.id}" class="primary">${r.status === 'open' ? '✅ Løst' : '↩️ Genåbn'}</button>
      </div></div></div>`;
  const open = reports.filter((r) => r.status === 'open');
  const closed = reports.filter((r) => r.status === 'closed');
  openPanel(
    'admin',
    head('🛡️ Moderation', 'Alle handlinger bliver logget.') +
      `<h3>Åbne sager (${open.length})</h3><div class="list">${open.map(card).join('') || '<p class="sub">Ingen åbne sager 🎉</p>'}</div>
      <h3>Start et event</h3><div class="row" style="display:flex;gap:6px;flex-wrap:wrap">
        <select id="evRoom">${['lobby', 'cafe', 'roof', 'arcade', 'pool'].map((r) => `<option value="${r}">${r}</option>`).join('')}</select>
        <input id="evName" maxlength="60" placeholder="Navn, fx Kagefest">
        <select id="evMin"><option value="30">30 min</option><option value="60" selected>1 time</option><option value="120">2 timer</option></select>
        <button id="evStart" class="small primary">🎉 Start</button><button id="evStop" class="small">Stop</button></div>
      ${closed.length ? `<h3>Løste sager</h3><div class="list">${closed.slice(0, 20).map(card).join('')}</div>` : ''}`,
  );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-ad]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        const action = b.dataset.ad as Extract<ClientMsg, { t: 'admin' }>['action'];
        const text = action === 'warn' ? (prompt('Besked til brugeren?') ?? undefined) : undefined;
        net?.send({
          t: 'admin',
          action,
          userId: b.dataset.u,
          reportId: b.dataset.r,
          minutes: b.dataset.m ? Number(b.dataset.m) : undefined,
          text,
        });
      }),
    );
  $('evStart').addEventListener('click', () =>
    net?.send({
      t: 'admin',
      action: 'eventStart',
      roomId: $<HTMLSelectElement>('evRoom').value,
      text: $<HTMLInputElement>('evName').value.trim() || undefined,
      minutes: Number($<HTMLSelectElement>('evMin').value),
    }),
  );
  $('evStop').addEventListener('click', () => net?.send({ t: 'admin', action: 'eventStop' }));
}

/* ---------------- trading ---------------- */
let trade: TradeView | null = null;
let offerT: number | undefined;
const clothesName = (k: string) => CLOTHES[k]?.name ?? k;
function offerHtml(o: TradeOfferView) {
  const parts = [
    ...(o.coins ? [`${o.coins} ${COIN}`] : []),
    ...o.items.map((it) => `${FURNITURE[it.type].icon} ${esc(FURNITURE[it.type].name)}`),
    ...o.clothes.map((k) => `👕 ${esc(clothesName(k))}`),
  ];
  return parts.length
    ? parts.map((p) => `<span class="badge">${p}</span>`).join('')
    : '<p class="sub">Intet endnu</p>';
}
function renderTradeAsk(from: { id: string; name: string }) {
  openPanel(
    'tradeAsk',
    head('🤝 Byttehandel', `${esc(from.name)} vil gerne bytte med dig.`) +
      `<div class="chips"><button data-r="yes" class="primary">Ja, lad os bytte</button><button data-r="no">Nej tak</button></div>`,
  );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-r]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        net?.send({ t: 'tradeReply', accept: b.dataset.r === 'yes' });
        if (b.dataset.r === 'no') closePanel();
      }),
    );
}
function renderTrade() {
  if (!me || !trade) return;
  const t = trade;
  const mine = t.mine;
  const tradeable = me.wardrobe.filter((k) => (CLOTHES[k]?.price ?? 0) > 0);
  const invChips = me.inventory
    .map(
      (it, i) =>
        `<button type="button" data-ti="${i}" class="${mine.inv.includes(i) ? 'on' : ''}">${FURNITURE[it.type].icon} ${esc(FURNITURE[it.type].name)}</button>`,
    )
    .join('');
  const clothChips = tradeable
    .map(
      (k) =>
        `<button type="button" data-tc="${esc(k)}" class="${mine.clothes.includes(k) ? 'on' : ''}">👕 ${esc(clothesName(k))}</button>`,
    )
    .join('');
  openPanel(
    'trade',
    head(
      '🤝 Byttehandel',
      `Med ${esc(t.partner.name)}. Ændres et tilbud, skal I begge godkende igen.`,
    ) +
      `<div class="trade"><div><h3>Du giver ${mine.coins ? '' : ''}</h3>
        <div class="row"><label>Mønter</label><input id="tCoins" type="number" min="0" max="${me.coins}" value="${mine.coins}" style="width:100px"></div>
        <div class="row"><label>Møbler fra dit inventar</label><div class="chips">${invChips || '<span class="sub">Gem møbler i inventaret under Byg (📦)</span>'}</div></div>
        ${tradeable.length ? `<div class="row"><label>Tøj</label><div class="chips">${clothChips}</div></div>` : ''}
        <p>${mine.inv.length || mine.clothes.length || mine.coins ? '' : '<span class="sub">Vælg hvad du vil give</span>'}</p>
        ${t.myOk ? '<p class="ok">✅ Du har godkendt</p>' : ''}
      </div><div><h3>${esc(t.partner.name)} giver</h3><div class="badges">${offerHtml(t.theirs)}</div>
        ${t.theirOk ? `<p class="ok">✅ ${esc(t.partner.name)} har godkendt</p>` : `<p class="sub">Venter på ${esc(t.partner.name)}…</p>`}
      </div></div>
      <div class="chips" style="margin-top:12px"><button id="tOk" class="primary" ${t.myOk ? 'disabled' : ''}>✅ Godkend bytte</button><button id="tCancel" class="danger">✕ Afbryd</button></div>`,
  );
  const send = (o: { coins: number; inv: number[]; clothes: string[] }) => {
    clearTimeout(offerT);
    offerT = window.setTimeout(() => net?.send({ t: 'tradeOffer', ...o }), 250);
  };
  const cur = () => ({ coins: mine.coins, inv: [...mine.inv], clothes: [...mine.clothes] });
  $('tCoins').addEventListener('change', (e) => {
    const v = Math.max(
      0,
      Math.min(me!.coins, Math.floor(Number((e.target as HTMLInputElement).value) || 0)),
    );
    send({ ...cur(), coins: v });
  });
  $('panel')
    .querySelectorAll<HTMLElement>('[data-ti]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        const i = Number(b.dataset.ti);
        const o = cur();
        o.inv = o.inv.includes(i) ? o.inv.filter((x) => x !== i) : [...o.inv, i];
        send(o);
      }),
    );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-tc]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.tc!;
        const o = cur();
        o.clothes = o.clothes.includes(k) ? o.clothes.filter((x) => x !== k) : [...o.clothes, k];
        send(o);
      }),
    );
  $('tOk').addEventListener('click', () => net?.send({ t: 'tradeAccept' }));
  $('tCancel').addEventListener('click', () => net?.send({ t: 'tradeCancel' }));
}

function renderFriends() {
  openPanel(
    'friends',
    head('👥 Venner') +
      `<div class="row" style="display:flex;gap:6px"><input id="frName" maxlength="16" placeholder="Navn på en gæst" style="flex:1"><button id="frAdd" class="small primary">Tilføj</button></div>` +
      (requests.length
        ? `<h3>Venneanmodninger</h3><div class="list">${requests.map((r) => `<div class="li"><div class="grow"><b>${esc(r.name)}</b></div><button class="small primary" data-acc="${r.id}">Ja</button><button class="small" data-dec="${r.id}">Nej</button></div>`).join('')}</div>`
        : '') +
      `<label class="sub" style="display:block;margin:8px 0"><input id="noFollow" type="checkbox" ${me?.noFollow ? 'checked' : ''}> 🔒 Må ikke følges – venner kan se, at jeg er online, men ikke hvor</label>` +
      `<h3>Dine venner</h3><div class="list">${friends.map((f) => `<div class="li"><div class="grow"><b>${me?.relations?.[f.id] ? RELATIONS[me.relations[f.id]!].icon + ' ' : ''}${esc(f.name)}</b><small>${f.online ? `<span class="status-on">● Online</span>${f.roomName ? ' · ' + esc(f.roomName) : ''}` : 'Offline'}</small></div>${f.online && f.roomId ? `<button class="small" data-go="${esc(f.roomId)}">Gå til</button>` : ''}<button class="small" data-pm="${esc(f.id)}">💬 Skriv${f.unread ? ` <b class="unread">${f.unread}</b>` : ''}</button></div>`).join('') || '<p class="sub">Ingen venner endnu – klik på en figur for at tilføje.</p>'}</div>`,
  );
  const p = $('panel');
  $<HTMLInputElement>('noFollow').addEventListener('change', (e) => {
    const on = (e.target as HTMLInputElement).checked;
    if (me) me.noFollow = on;
    net?.send({ t: 'setPrivacy', noFollow: on });
  });
  $('frAdd').addEventListener('click', () => {
    const n = $<HTMLInputElement>('frName').value.trim();
    if (n.length >= 2) net?.send({ t: 'friendRequest', name: n });
  });
  p.querySelectorAll<HTMLElement>('[data-acc]').forEach((b) =>
    b.addEventListener('click', () =>
      net?.send({ t: 'friendRespond', userId: b.dataset.acc!, accept: true }),
    ),
  );
  p.querySelectorAll<HTMLElement>('[data-dec]').forEach((b) =>
    b.addEventListener('click', () =>
      net?.send({ t: 'friendRespond', userId: b.dataset.dec!, accept: false }),
    ),
  );
  p.querySelectorAll<HTMLElement>('[data-go]').forEach((b) =>
    b.addEventListener('click', () => goTo(b.dataset.go!)),
  );
  p.querySelectorAll<HTMLElement>('[data-pm]').forEach((b) =>
    b.addEventListener('click', () => openPm(b.dataset.pm!)),
  );
}

function openPm(friendId: string) {
  pmWith = friendId;
  renderPm(friendId);
  net?.send({ t: 'pmHistory', with: friendId });
}

function renderPm(friendId: string) {
  const f = friends.find((x) => x.id === friendId);
  const lines = pmLog.get(friendId) ?? [];
  openPanel(
    'pm',
    head(
      `💬 ${esc(f?.name ?? '?')}`,
      f?.online ? 'Online nu' : 'Offline – beskeden venter til næste gang, de logger ind',
    ) +
      `<div id="pmLines" class="pmlines"></div>` +
      `<form id="pmForm" style="display:flex;gap:6px;margin-top:8px"><input id="pmIn" maxlength="240" placeholder="Skriv en besked…" style="flex:1" autocomplete="off"><button class="small primary">Send</button></form>` +
      `<p style="margin-top:8px"><button id="pmBack" class="small">← Venner</button></p>`,
  );
  const box = $('pmLines');
  if (!lines.length) box.innerHTML = '<p class="sub">Ingen beskeder endnu. Sig hej!</p>';
  for (const l of lines) {
    const row = document.createElement('div');
    row.className = 'pmline' + (l.from === me?.id ? ' me' : '');
    row.textContent = l.text; // never HTML
    row.title = new Date(l.at).toLocaleString('da-DK');
    box.appendChild(row);
  }
  box.scrollTop = box.scrollHeight;
  $('pmForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $<HTMLInputElement>('pmIn');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    net?.send({ t: 'whisper', to: friendId, text });
  });
  $('pmBack').addEventListener('click', renderFriends);
  $('pmIn').focus();
}

function renderProfile(p: ProfileView) {
  const self = p.id === me?.id;
  const inMyRoom = isOwner() && !self && !p.bot;
  openPanel(
    'profile',
    head(
      `${p.bot ? '🤖 ' : ''}${esc(p.name)}`,
      p.bot
        ? 'AI-beboer på Hutel. Svarene er skrevet af en AI.'
        : p.since
          ? `Gæst siden ${p.since}`
          : '',
    ) +
      (p.motto ? `<p>“${esc(p.motto)}”</p>` : '') +
      (p.badges.length
        ? `<div class="badges">${p.badges.map((b) => `<span class="badge">${BADGES[b].icon} ${BADGES[b].name}</span>`).join('')}</div>`
        : '') +
      (p.relations?.length
        ? `<div class="relations">${p.relations.map((r) => `<div><b>${RELATIONS[r.kind].icon} ${RELATIONS[r.kind].name}</b> ${r.users.map((u) => `<button class="small" data-prof="${esc(u.id)}">${esc(u.name)}</button>`).join(' ')}</div>`).join('')}</div>`
        : '') +
      (p.friend && !self
        ? `<div class="chips" style="margin:8px 0"><span class="sub">Marker ${esc(p.name)}:</span>${RELATION_IDS.map((k) => `<button data-rel="${k}" class="${me?.relations?.[p.id] === k ? 'primary' : ''}" title="${RELATIONS[k].name}">${RELATIONS[k].icon}</button>`).join('')}</div>`
        : '') +
      (p.bot ? '' : profileHome(p, self)) +
      (!self && !p.bot
        ? `<div class="chips" style="margin-top:12px">
          ${p.here ? `<button data-a="hush">🤫 Hvisk</button>` : ''}
          ${p.here && myActor()?.carry ? `<button data-a="give" class="primary">🎁 Giv ${CARRY[myActor()!.carry as CarryKind].icon}</button>` : ''}
          ${p.friend ? `<button data-a="pm">💬 Messenger</button><button data-a="unfriend">Fjern ven</button>` : `<button data-a="friend" class="primary">➕ Tilføj ven</button>`}
          ${inMyRoom ? `<button data-a="rights">🔨 Giv byggerettigheder</button><button data-a="norights">Fjern rettigheder</button>` : ''}
          ${p.here && questsDone() ? `<button data-a="trade">🤝 Byt</button>` : ''}
          ${me?.role !== 'user' ? `<button data-a="modmute">🔇 Pause 1 t</button><button data-a="modkick">🚪 Send hjem</button>` : ''}
          <button data-a="block">${p.blocked ? 'Fjern blokering' : '🚫 Blokér'}</button><button data-a="report" class="danger">⚠️ Rapportér</button></div>
         <div id="repBox" class="hidden" style="margin-top:10px"><textarea id="repText" rows="3" maxlength="300" placeholder="Hvad skete der?" style="width:100%"></textarea><button id="repSend" class="small danger">Send rapport</button></div>`
        : ''),
  );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-a]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        const a = b.dataset.a;
        if (a === 'friend') net?.send({ t: 'friendRequest', name: p.name });
        if (a === 'unfriend') net?.send({ t: 'friendRemove', userId: p.id });
        if (a === 'rights') net?.send({ t: 'rights', userId: p.id, grant: true });
        if (a === 'norights') net?.send({ t: 'rights', userId: p.id, grant: false });
        if (a === 'block') net?.send({ t: 'block', userId: p.id, block: !p.blocked });
        if (a === 'modmute') net?.send({ t: 'admin', action: 'mute', userId: p.id, minutes: 60 });
        if (a === 'modkick') net?.send({ t: 'admin', action: 'kick', userId: p.id });
        if (a === 'give') {
          net?.send({ t: 'carryGive', userId: p.id });
          return closePanel();
        }
        if (a === 'trade') {
          closePanel();
          net?.send({ t: 'tradeStart', userId: p.id });
        }
        if (a === 'pm') return openPm(p.id);
        if (a === 'hush') {
          closePanel();
          $<HTMLInputElement>('chatIn').value = `/h ${p.name} `;
          $('chatIn').focus();
          return;
        }
        if (a === 'report') $('repBox').classList.remove('hidden');
        if (a !== 'report') setTimeout(() => net?.send({ t: 'profile', userId: p.id }), 300);
      }),
    );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-rel]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        if (!me) return;
        const cur = me.relations?.[p.id];
        const next = cur === b.dataset.rel ? null : (b.dataset.rel as keyof typeof RELATIONS);
        me.relations = { ...(me.relations ?? {}) };
        if (next) me.relations[p.id] = next;
        else delete me.relations[p.id];
        net?.send({ t: 'setRelation', userId: p.id, kind: next });
        setTimeout(() => net?.send({ t: 'profile', userId: p.id }), 250);
      }),
    );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-prof]')
    .forEach((b) =>
      b.addEventListener('click', () => net?.send({ t: 'profile', userId: b.dataset.prof! })),
    );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-proom]')
    .forEach((b) => b.addEventListener('click', () => goTo(b.dataset.proom!)));
  $('panel')
    .querySelectorAll<HTMLElement>('[data-gbdel]')
    .forEach((b) =>
      b.addEventListener('click', () =>
        net?.send({ t: 'guestbookDelete', userId: p.id, id: b.dataset.gbdel! }),
      ),
    );
  $('gbSend')?.addEventListener('click', () => {
    const text = $<HTMLTextAreaElement>('gbText').value.trim();
    if (text) net?.send({ t: 'guestbookWrite', userId: p.id, text });
  });
  $('mottoSave')?.addEventListener('click', () => {
    net?.send({ t: 'motto', motto: $<HTMLInputElement>('mottoIn').value });
    setTimeout(() => net?.send({ t: 'profile', userId: p.id }), 300);
  });
  $('repSend')?.addEventListener('click', () => {
    const r = $<HTMLTextAreaElement>('repText').value.trim();
    if (r.length >= 3) {
      net?.send({ t: 'report', userId: p.id, reason: r });
      closePanel();
    }
  });
}

/** The "home page" part of a profile: level, pet, friends, rooms and the guestbook. */
function profileHome(p: ProfileView, self: boolean) {
  const when = (at: number) =>
    new Date(at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  const pet = p.pet ? `${PET_KINDS[p.pet.kind].icon} ${esc(p.pet.name)} (lv ${p.pet.level})` : '';
  const facts = [
    p.online ? '<span class="status-on">● Online</span>' : 'Offline',
    p.level ? `⭐ Level ${p.level}` : '',
    pet,
  ]
    .filter(Boolean)
    .join(' · ');
  const friends = (p.friends ?? [])
    .map((f) => `<button class="small" data-prof="${esc(f.id)}">${esc(f.name)}</button>`)
    .join('');
  const rooms = (p.rooms ?? [])
    .map(
      (r) =>
        `<div class="li"><div class="grow"><b>${esc(r.name)}</b></div><span class="users">👤 ${r.users}</span><button class="small" data-proom="${esc(r.id)}">Gå</button></div>`,
    )
    .join('');
  const book = (p.guestbook ?? [])
    .map((e) => {
      const canDel = self || e.fromId === me?.id || me?.role !== 'user';
      // Guestbook text is shown with textContent semantics via esc() (never as HTML).
      return `<div class="gb"><div><b data-prof="${esc(e.fromId)}" style="cursor:pointer">${esc(e.fromName)}</b> <small>${when(e.at)}</small>${canDel ? ` <button class="small" data-gbdel="${esc(e.id)}" title="Slet">✕</button>` : ''}</div><div>${esc(e.text)}</div></div>`;
    })
    .join('');
  return `<p class="sub">${facts}</p>
    ${self ? `<div class="row" style="display:flex;gap:6px"><input id="mottoIn" maxlength="60" placeholder="Dit motto" value="${esc(p.motto)}" style="flex:1"><button id="mottoSave" class="small">Gem motto</button></div>` : ''}
    <h3>👥 Venner (${p.friendCount ?? 0})</h3><div class="chips">${friends || '<span class="sub">Ingen venner endnu</span>'}</div>
    ${rooms ? `<h3>🏠 Værelser</h3><div class="list">${rooms}</div>` : ''}
    <h3>📖 Gæstebog</h3>
    ${self ? '' : `<div style="display:flex;gap:6px;margin-bottom:8px"><textarea id="gbText" rows="2" maxlength="200" placeholder="Skriv en hilsen til ${esc(p.name)}…" style="flex:1"></textarea><button id="gbSend" class="small primary">Skriv</button></div>`}
    <div class="gbook">${book || '<p class="sub">Ingen hilsner endnu.</p>'}</div>`;
}

function renderPassword(roomId: string) {
  openPanel(
    'pw',
    head('🔑 Adgangskode', 'Værelset er beskyttet med en adgangskode.') +
      `<div style="display:flex;gap:6px"><input id="pwIn" type="password" maxlength="40" style="flex:1"><button id="pwGo" class="primary">Gå ind</button></div>`,
  );
  const go = () => goTo(roomId, $<HTMLInputElement>('pwIn').value);
  $('pwGo').addEventListener('click', go);
  $('pwIn').addEventListener('keydown', (e) => e.key === 'Enter' && go());
  $('pwIn').focus();
}

/* ---------------- building ---------------- */
function setBuild(on: boolean) {
  if (!on) cancelHeld();
  build = on && !!room?.canBuild;
  gridHelper.visible = build;
  $('bBuild').classList.toggle('on', build);
  hoverM.visible = false;
  updateBuildbar();
}
/** Terrain tool in build mode: raise or lower the tile you click. */
let terrain: 'up' | 'down' | null = null;
function setTerrain(t: 'up' | 'down' | null) {
  terrain = terrain === t ? null : t;
  if (terrain) cancelHeld();
  updateBuildbar();
}
function updateBuildbar() {
  $('buildbar').classList.toggle('hidden', !build);
  const h = !!held;
  if (!build) terrain = null;
  $('bbText').textContent = h
    ? 'Klik på gulvet for at placere · R roterer · F skifter farve'
    : terrain === 'up'
      ? 'Klik på et felt for at hæve det et trin (lav trapper ét trin ad gangen)'
      : terrain === 'down'
        ? 'Klik på et felt for at sænke det et trin'
        : 'Byggetilstand: klik på et møbel for at flytte det';
  $('bbUp').classList.toggle('hidden', h);
  $('bbDown').classList.toggle('hidden', h);
  $('bbUp').classList.toggle('on', terrain === 'up');
  $('bbDown').classList.toggle('on', terrain === 'down');
  $('bbRot').classList.toggle('hidden', !h);
  $('bbColor').classList.toggle(
    'hidden',
    !h || !furniture(held!.item.type).colors || held!.inv !== undefined,
  );
  $('bbCancel').classList.toggle('hidden', !h);
  $('bbSell').classList.toggle('hidden', !h || !!held?.isNew || !isOwner());
  $('bbStash').classList.toggle('hidden', !h || !!held?.isNew || !isOwner());
  if (held && !held.isNew) $('bbSell').textContent = `💰 Sælg (+${sellPrice(held.item.type)})`;
}
function heldOk() {
  if (!held) return false;
  const others = [...items.values()].filter((o) => o.id !== held!.item.id);
  const occupied = [...actors.values()]
    .filter((a) => a.seatId !== held!.item.id)
    .map((a) => a.tile());
  const b = room ? themeWallBlocks(room.theme, fl()) : {};
  const doors = room?.doors ?? [];
  const blocks = {
    back: [...(b.back ?? []), ...doors.filter((d) => d.wall === 0).map((d) => d.idx)],
    left: [...(b.left ?? []), ...doors.filter((d) => d.wall === 1).map((d) => d.idx)],
  };
  return canPlace(fl(), others, held.item, occupied, blocks);
}
function updHeld() {
  if (!held) {
    placeM.visible = false;
    return;
  }
  const wallIt = isWallItem(held.item.type);
  const g = placeObj(held.item, wallIt ? 0.05 : 0.12);
  const f = footprint(held.item);
  placeM.visible = true;
  if (wallIt) {
    // Highlight the strip of floor right under the wall item.
    const w = furniture(held.item.type).w;
    const side = held.item.rot % 2 === 1;
    placeM.scale.set(side ? 1 : w, side ? w : 1, 1);
    placeM.position.set(side ? tw(0) : g.position.x, 0.02, side ? g.position.z : tw(0));
  } else {
    placeM.scale.set(f.w, f.d, 1);
    placeM.position.set(g.position.x, 0.02 + groundAt(held.item.x, held.item.z), g.position.z);
  }
  (placeM.material as T.MeshBasicMaterial).color.setHex(heldOk() ? 0x6fd36f : 0xe0564a);
}
function moveHeldTo(t: { x: number; z: number; wall?: number }) {
  if (!held) return;
  if (isWallItem(held.item.type)) {
    // Point at a wall, or at the floor near it: the nearest wall wins.
    const side = t.wall !== undefined ? t.wall === 1 : t.z > t.x;
    const w = furniture(held.item.type).w;
    held.item.rot = side ? 1 : 0;
    held.item.z = 0;
    held.item.x = Math.max(0, Math.min(rs() - w, (side ? t.z : t.x) - Math.floor((w - 1) / 2)));
    return updHeld();
  }
  const f = footprint(held.item);
  held.item.x = Math.max(0, Math.min(rs() - f.w, t.x - Math.floor((f.w - 1) / 2)));
  held.item.z = Math.max(0, Math.min(rs() - f.d, t.z - Math.floor((f.d - 1) / 2)));
  updHeld();
}
function pickUp(it: PlacedItem) {
  held = { item: { ...it }, isNew: false, orig: it };
  removeObj(it.id);
  updHeld();
  updateBuildbar();
}
function startBuy(type: FurnitureType) {
  if (!me || !isOwner()) return toast('Du kan kun købe møbler til dit eget værelse', 'error');
  if (me.coins < furniture(type).price)
    return toast('Du har ikke mønter nok – klar en opgave 🙂', 'error');
  cancelHeld();
  closePanel();
  setBuild(true);
  held = {
    item: {
      id: -Date.now(),
      type,
      x: isWallItem(type) ? 2 : 3,
      z: isWallItem(type) ? 0 : 4,
      rot: 0,
    },
    isNew: true,
  };
  updHeld();
  updateBuildbar();
}
function tryPlace() {
  if (!held) return;
  if (!heldOk()) return toast('Det kan ikke stå der 🙃', 'error');
  const it = held.item;
  if (held.isNew && held.inv !== undefined) {
    net?.send({ t: 'placeInv', index: held.inv, x: it.x, z: it.z, rot: it.rot });
    removeObj(it.id);
  } else if (held.isNew) {
    net?.send({ t: 'buy', type: it.type, x: it.x, z: it.z, rot: it.rot, color: it.color });
    removeObj(it.id);
  } else {
    net?.send({
      t: 'moveItem',
      id: it.id,
      x: it.x,
      z: it.z,
      rot: it.rot,
      color: it.color ?? 0,
    });
    placeObj(held.orig!);
  }
  held = null;
  placeM.visible = false;
  updateBuildbar();
}
function cancelHeld() {
  if (!held) return;
  if (held.isNew) removeObj(held.item.id);
  else placeObj(held.orig!);
  held = null;
  placeM.visible = false;
  updateBuildbar();
}
function rotateHeld() {
  if (!held) return;
  held.item.rot = isWallItem(held.item.type) ? (held.item.rot + 1) % 2 : (held.item.rot + 1) % 4;
  updHeld();
}
function startPlaceInv(index: number) {
  const entry = me?.inventory[index];
  if (!entry || !isOwner()) return;
  cancelHeld();
  closePanel();
  setBuild(true);
  held = {
    item: { id: -Date.now(), type: entry.type, x: 3, z: 4, rot: 0, color: entry.color },
    isNew: true,
    inv: index,
  };
  updHeld();
  updateBuildbar();
}
function stashHeld() {
  if (!held || held.isNew) return;
  net?.send({ t: 'stash', id: held.item.id });
  held = null;
  placeM.visible = false;
  updateBuildbar();
}
function recolorHeld() {
  if (!held || held.inv !== undefined) return;
  const n = furniture(held.item.type).colors?.length ?? 0;
  if (!n) return;
  held.item.color = ((held.item.color ?? 0) + 1) % n;
  updHeld();
}
function sellHeld() {
  if (!held || held.isNew) return cancelHeld();
  net?.send({ t: 'sellItem', id: held.item.id });
  held = null;
  placeM.visible = false;
  updateBuildbar();
}

/* ---------------- input ---------------- */
const ray = new T.Raycaster();
const ptr = new T.Vector2();
function setPtr(e: { clientX: number; clientY: number }) {
  const r = cv.getBoundingClientRect();
  ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ptr, stage.camera);
}
function hitTile(): { x: number; z: number } | null {
  const h = ray.intersectObjects(roomGfx.tiles, false)[0];
  return h ? (h.object.userData.tile as { x: number; z: number }) : null;
}
/** Where on a wall the pointer is (for hanging things), as a tile index along that wall. */
function hitWall(): { x: number; z: number; wall: number } | null {
  const h = ray.intersectObjects(roomGfx.walls, false)[0];
  if (!h) return null;
  const wall = h.object.userData.wall as number;
  const idx = Math.round((wall ? h.point.z : h.point.x) + rs() / 2 - 0.5);
  const i = Math.max(0, Math.min(rs() - 1, idx));
  return wall ? { x: 0, z: i, wall } : { x: i, z: 0, wall };
}
/** Target for the item in hand: walls first for wall items. */
function heldTarget() {
  if (held && isWallItem(held.item.type)) return hitWall() ?? hitTile();
  return hitTile();
}
function hitItem(incWalk: boolean): PlacedItem | null {
  for (const h of ray.intersectObjects(furnRoot.children, true)) {
    const it = items.get(h.object.userData.itemId as number);
    if (it && (incWalk || !furniture(it.type).walk)) return it;
  }
  return null;
}
function hitActor(): Actor | null {
  const objsA = [...actors.values()].map((a) => a.obj);
  const h = ray.intersectObjects(objsA, true)[0];
  return h ? (actors.get(h.object.userData.playerId as string) ?? null) : null;
}
function onHover() {
  const t = hitTile();
  if (held) {
    const ht = heldTarget();
    if (ht) moveHeldTo(ht);
    return;
  }
  const it = hitItem(build);
  const onDoor =
    !build &&
    (ray.intersectObject(roomGfx.doorGroup, true).length > 0 ||
      ray.intersectObject(roomGfx.aptDoors, true).length > 0);
  const onActor = !build && !!hitActor();
  cv.style.cursor =
    onDoor ||
    onActor ||
    (it &&
      (build || furniture(it.type).seat || furniture(it.type).states || it.type === 'teleport'))
      ? 'pointer'
      : 'default';
  if (t && ((!build && !it && !onActor) || (build && terrain))) {
    hoverM.visible = true;
    hoverM.position.set(tw(t.x), 0.012 + groundAt(t.x, t.z), tw(t.z));
  } else hoverM.visible = false;
}
function onClick() {
  if (!net || !room) return;
  if (held) {
    const t = heldTarget();
    if (t) moveHeldTo(t);
    return tryPlace();
  }
  if (build && terrain) {
    const t = hitTile();
    if (!t || !room) return;
    const cur = tileHeight(fl(), t.x, t.z);
    const h = Math.max(0, Math.min(MAX_TILE_HEIGHT, cur + (terrain === 'up' ? 1 : -1)));
    if (h !== cur) net.send({ t: 'setHeight', x: t.x, z: t.z, h });
    return;
  }
  if (build) {
    const it = hitItem(true);
    if (it) pickUp(it);
    return;
  }
  const petHit = ray.intersectObjects(
    [...pets.values()].map((p) => p.obj),
    true,
  )[0];
  if (petHit) {
    const owner = petHit.object.userData.petOwner as string;
    if (owner === me?.id) return renderPets();
    const p = pets.get(owner);
    if (p) {
      p.play('happy');
      return toast(`${PET_KINDS[p.view.kind].icon} ${p.view.name} · level ${p.view.level}`);
    }
  }
  const a = hitActor();
  if (a) return net.send({ t: 'profile', userId: a.id });
  const aptHit = ray.intersectObject(roomGfx.aptDoors, true)[0];
  if (aptHit && room) {
    // Walk into the door: arriving in front of it takes you through.
    const i = aptHit.object.userData.aptDoor as number;
    if (room.doors[i]) return net.send({ t: 'aptDoor', index: i });
  }
  if (ray.intersectObject(roomGfx.doorGroup, true).length) {
    if (!onboarded()) return toast('Døren er låst 🔒 Klar startopgaverne først');
    return openNavigator();
  }
  const it = hitItem(false);
  if (it && it.type === 'gamebox') return renderGames(it.id);
  if (it && it.type === 'jukebox') return renderJukebox(it.id);
  if (it && it.type === 'noteboard') return openNotes();
  const disp = it ? furniture(it.type).dispense : undefined;
  if (it && disp?.length) {
    if (disp.length === 1) return net.send({ t: 'dispense', itemId: it.id, kind: disp[0]! });
    return renderDispense(it.id, disp);
  }
  if (
    it &&
    furniture(it.type).states &&
    it.type !== 'colortile' &&
    (room?.canBuild || me?.role !== 'user')
  )
    return net.send({ t: 'use', itemId: it.id });
  if (it && it.type === 'teleport') audio.sfx('teleport');
  if (it && it.type === 'teleport') return net.send({ t: 'teleport', itemId: it.id });
  if (it && furniture(it.type).seat) return net.send({ t: 'sit', itemId: it.id });
  const t = hitTile();
  if (t) {
    predictWalk([t.x, t.z], running);
    net.send({ t: 'move', x: t.x, z: t.z, run: running });
  }
  $('hint').style.opacity = '0';
}
let down: { x: number; y: number } | null = null;
let panning = false;
const pointers = new Map<number, { x: number; y: number }>();
let pinchDist = 0;
function pan(dx: number, dy: number) {
  const scale = (stage.camera.right - stage.camera.left) / (stage.camera.zoom * innerWidth);
  stage.camera.translateX(-dx * scale);
  stage.camera.translateY(dy * scale);
  // keep the room in view
  const p = stage.camera.position;
  const cx = p.x - 11;
  const cz = p.z - 11;
  if (Math.hypot(cx, cz) > 6) {
    const k = 6 / Math.hypot(cx, cz);
    p.x = 11 + cx * k;
    p.z = 11 + cz * k;
  }
}
cv.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  down = { x: e.clientX, y: e.clientY };
  panning = false;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
  }
});
cv.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (prev) {
    if (pointers.size === 2) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinchDist > 0) {
        stage.camera.zoom = Math.min(2.4, Math.max(0.7, stage.camera.zoom * (d / pinchDist)));
        stage.camera.updateProjectionMatrix();
      }
      pinchDist = d;
      panning = true;
      return;
    }
    if (down && !held && (panning || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10)) {
      panning = true;
      pan(e.clientX - prev.x, e.clientY - prev.y);
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  setPtr(e);
  onHover();
});
const endPointer = (e: PointerEvent) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchDist = 0;
};
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('pointerup', (e) => {
  endPointer(e);
  if (!down) return;
  const wasPan = panning;
  down = null;
  panning = false;
  if (wasPan) return;
  setPtr(e);
  onClick();
});
if (innerWidth / innerHeight < 0.8) {
  stage.camera.zoom = 1.45;
  stage.camera.updateProjectionMatrix();
}

const KEYMAP: Record<string, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
};
addEventListener('keydown', (e) => {
  running = e.shiftKey;
  if (
    (e.target as HTMLElement).tagName === 'INPUT' ||
    (e.target as HTMLElement).tagName === 'TEXTAREA'
  )
    return;
  const k = KEYMAP[e.key];
  if (k && !held) {
    e.preventDefault();
    keys.add(k);
    $('hint').style.opacity = '0';
    return;
  }
  if ((e.key === 'r' || e.key === 'R') && held) rotateHeld();
  else if ((e.key === 'f' || e.key === 'F') && held) recolorHeld();
  else if (e.key === 'Escape') {
    if (held) cancelHeld();
    else if (build) setBuild(false);
    else closePanel();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && held) sellHeld();
  else if (e.key === 'Enter') $('chatIn').focus();
});
addEventListener('keyup', (e) => {
  running = e.shiftKey;
  const k = KEYMAP[e.key];
  if (k) keys.delete(k);
});
addEventListener('blur', () => {
  keys.clear();
  running = false;
});

/**
 * Arrow keys walk freely in screen directions, like the prototype: the figure moves at once
 * and slides along furniture and walls. The position goes to the server ~10×/s ('glide').
 */
let lastGlideSent = 0;
let gliding = false;
function keyboardWalk(dt: number) {
  const a = myActor();
  if (!a || !net || held) return;
  let ix = 0;
  let iz = 0;
  if (keys.has('up')) {
    ix -= 1;
    iz -= 1;
  }
  if (keys.has('down')) {
    ix += 1;
    iz += 1;
  }
  if (keys.has('right')) {
    ix += 1;
    iz -= 1;
  }
  if (keys.has('left')) {
    ix -= 1;
    iz += 1;
  }
  const now = performance.now();
  if (!ix && !iz) {
    if (gliding) {
      gliding = false;
      net.send({ t: 'glide', x: a.x, z: a.z, run: running });
    }
    return;
  }
  const l = Math.hypot(ix, iz);
  ix /= l;
  iz /= l;
  const grid = buildGrid(fl(), [...items.values()]);
  const [cx, cz] = a.tile();
  const R = 0.28;
  const free = (x: number, z: number) => {
    const tx = Math.round(x);
    const tz = Math.round(z);
    if (tx < 0 || tz < 0 || tx >= rs() || tz >= rs()) return false;
    if (tx === cx && tz === cz) return true;
    return grid.cells[tx]![tz] === 0 && canStep(grid, cx, cz, tx, tz);
  };
  const st = WALK_SPEED * (running ? RUN_MULTIPLIER : 1) * dt;
  let x = a.x;
  let z = a.z;
  const nx = x + ix * st;
  if (free(nx + Math.sign(ix) * R, z)) x = nx;
  const nz = z + iz * st;
  if (free(x, nz + Math.sign(iz) * R)) z = nz;
  x = Math.min(rs() - 0.68, Math.max(-0.32, x));
  z = Math.min(rs() - 0.68, Math.max(-0.32, z));
  a.glide(x, z, running, Math.atan2(ix, iz));
  gliding = true;
  pending.length = 0;
  $('hint').style.opacity = '0';
  // Pushing into the door opens the hotel (same as clicking it).
  if (
    (keys.has('up') || keys.has('right')) &&
    z < -0.25 &&
    Math.round(x) === DOOR_TILE[0] &&
    Math.round(z) === DOOR_TILE[1] &&
    now > doorNagUntil
  ) {
    doorNagUntil = now + 2500;
    if (onboarded()) openNavigator();
    else toast('Døren er låst 🔒 Klar startopgaverne først');
  }
  if (now - lastGlideSent > 100) {
    lastGlideSent = now;
    net.send({ t: 'glide', x, z, run: running });
  }
}
let doorNagUntil = 0;

/* ---------------- buttons ---------------- */
$('bNav').addEventListener(
  'click',
  toggle('nav', () =>
    onboarded() ? openNavigator() : toast('Klar startopgaverne først – så åbner hotellet sig 🚪'),
  ),
);
$('bFriends').addEventListener('click', toggle('friends', renderFriends));
$('bFig').addEventListener('click', toggle('fig', renderFigure));
$('bPets').addEventListener('click', toggle('pets', renderPets));
$('bSound').addEventListener('click', toggle('sound', renderSound));
$('panel').addEventListener('change', () => panelKind === 'sound' && updateSoundIcon());
$('bMarket').addEventListener('click', toggle('market', openMarket));
$('bShop').addEventListener('click', toggle('shop', renderShop));
$('bBuild').addEventListener('click', () => {
  closePanel();
  setBuild(!build);
});
$('bWave').addEventListener('click', () => net?.send({ t: 'action', kind: 'wave' }));
$('bDance').addEventListener('click', toggle('moves', renderMoves));
$('bbRot').addEventListener('click', rotateHeld);
$('bbColor').addEventListener('click', recolorHeld);
$('bbSell').addEventListener('click', sellHeld);
$('bbStash').addEventListener('click', stashHeld);
$('bbCancel').addEventListener('click', cancelHeld);
$('bbUp').addEventListener('click', () => setTerrain('up'));
$('bbDown').addEventListener('click', () => setTerrain('down'));
$('qHead').addEventListener('click', () => $('quests').classList.toggle('min'));
$('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const inp = $<HTMLInputElement>('chatIn');
  const text = inp.value.trim();
  if (!text || !net) return;
  inp.value = '';
  const h = /^\/(h|hvisk)\s+(\S+)\s+(.+)$/i.exec(text);
  if (h) {
    const a = [...actors.values()].find(
      (x) => !x.view.bot && x.view.name.toLowerCase() === h[2]!.toLowerCase(),
    );
    if (!a) return toast(`Der er ingen ${h[2]} her i rummet`, 'error');
    net.send({ t: 'hush', to: a.view.id, text: h[3]! });
    inp.value = `/h ${a.view.name} `; // stay in whisper mode until you clear it
    return;
  }
  const w = /^\/w\s+(\S+)\s+(.+)$/i.exec(text);
  if (w) {
    const f = friends.find((x) => x.name.toLowerCase() === w[1]!.toLowerCase());
    if (!f) return toast('Messengeren virker kun med venner', 'error');
    return net.send({ t: 'whisper', to: f.id, text: w[2]! });
  }
  if (/^\/(dans|dance)$/i.test(text)) return net.send({ t: 'action', kind: 'dance' });
  if (/^\/(vink|wave)$/i.test(text)) return net.send({ t: 'action', kind: 'wave' });
  if (/^\/(hjælp|help)$/i.test(text))
    return logLine({
      text: 'Kommandoer: :shout tekst (råb) · :sit · :sov · :kram · :highfive · :tænk · :dans · :vink · :heart · :haha · :zzz · :zap · /terning · /ssp sten|saks|papir · /quiz · /h navn besked (hvisk) · /w ven besked (messenger)',
      cls: 'sys',
    });
  net.send({ t: 'chat', text });
});

/* ---------------- sign-up / login ---------------- */
type AuthMode = 'social' | 'signup' | 'login' | 'profile';
let authCfg: AuthConfig = {
  auth: 'password',
  supabaseUrl: null,
  supabaseAnonKey: null,
  inviteRequired: false,
  providers: [],
};
let authMode: AuthMode = 'signup';
let signupLook: Look = { ...DEFAULT_LOOK };
const social = () => authCfg.auth === 'supabase';
function showSignup(error = '', mode: AuthMode = social() ? 'social' : 'signup') {
  authMode = mode;
  $('signup').classList.remove('hidden');
  $('authCard').classList.toggle('hidden', mode !== 'social');
  $('authGoogle').classList.toggle('hidden', !authCfg.providers.includes('google'));
  $('authFacebook').classList.toggle('hidden', !authCfg.providers.includes('facebook'));
  $('signupForm').classList.toggle('hidden', mode !== 'signup' && mode !== 'profile');
  $('loginForm').classList.toggle('hidden', mode !== 'login');
  // A social account has no Hutel password – the profile step only asks for name and figure.
  const profile = mode === 'profile';
  // In the profile step the password is optional: it links an old name+password account.
  $('suPwLabel').textContent = profile
    ? 'Gammel adgangskode (kun hvis du har en konto)'
    : 'Adgangskode';
  $<HTMLInputElement>('suPw').required = !profile;
  $<HTMLInputElement>('suPw').placeholder = profile
    ? 'Behold din gamle figur og dine mønter'
    : 'Mindst 8 tegn';
  $<HTMLInputElement>('suPw').minLength = profile ? 0 : 8;
  $('toLoginRow').classList.toggle('hidden', profile || social());
  $('toSocialRow').classList.toggle('hidden', !social());
  $('signupForm').querySelector('h1')!.textContent = profile
    ? 'Lav din figur'
    : 'Velkommen til Hutel';
  $('authError').textContent = mode === 'social' ? error : '';
  $('suError').textContent = mode === 'signup' || profile ? error : '';
  $('liError').textContent = mode === 'login' ? error : '';
  lookEditor($('suLook'), signupLook, (l) => (signupLook = l));
}
/** Trade a Supabase login for a Hutel game token (and create the figure the first time). */
async function exchange(profile?: object): Promise<boolean> {
  const at = await accessToken(authCfg).catch(() => null);
  if (!at) return false;
  const res = await fetch(`${SERVER}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accessToken: at, profile }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    token?: string;
    needsProfile?: boolean;
    error?: string;
  };
  if (data.ok && data.needsProfile) {
    showSignup('', 'profile');
    return true;
  }
  if (!data.ok || !data.token) {
    showSignup(data.error ?? 'Noget gik galt.', profile ? 'profile' : 'social');
    return true;
  }
  store.set(TOKEN_KEY, data.token);
  $('signup').classList.add('hidden');
  start(data.token);
  return true;
}
$('termsLink').addEventListener('click', (e) => {
  e.preventDefault();
  $('terms').classList.remove('hidden');
});
$('toLogin').addEventListener('click', (e) => {
  e.preventDefault();
  showSignup('', 'login');
});
$('toSignup').addEventListener('click', (e) => {
  e.preventDefault();
  showSignup('', social() ? 'social' : 'signup');
});
$('toPwLogin').addEventListener('click', (e) => {
  e.preventDefault();
  showSignup('', 'login');
});
$('toSocial').addEventListener('click', (e) => {
  e.preventDefault();
  showSignup('', 'social');
});
for (const [id, provider] of [
  ['authGoogle', 'google'],
  ['authFacebook', 'facebook'],
] as const)
  $(id).addEventListener('click', () => {
    $('authError').textContent = '';
    signInWithProvider(authCfg, provider).catch(
      () => ($('authError').textContent = 'Det login virker ikke lige nu. Prøv e-mail i stedet.'),
    );
  });
$('emailForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $<HTMLInputElement>('authEmail').value.trim();
  $('authError').textContent = '';
  try {
    await signInWithEmail(authCfg, email);
    $('authMsg').textContent = `Tjek din mail (${email}) – klik på linket for at komme ind. ✉️`;
  } catch {
    $('authError').textContent = 'Kunne ikke sende mailen. Tjek adressen og prøv igen om lidt.';
  }
});
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const res = await fetch(`${SERVER}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: $<HTMLInputElement>('liName').value.trim(),
        password: $<HTMLInputElement>('liPw').value,
      }),
    });
    const data = (await res.json()) as { ok: boolean; token?: string; error?: string };
    if (!data.ok || !data.token)
      return ($('liError').textContent = data.error ?? 'Noget gik galt.');
    store.set(TOKEN_KEY, data.token);
    start(data.token);
  } catch {
    $('liError').textContent = 'Kan ikke nå hotellet lige nu. Prøv igen om lidt.';
  }
});
$('termsClose').addEventListener('click', () => $('terms').classList.add('hidden'));
$('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $<HTMLInputElement>('suName').value.trim();
  const adult = $<HTMLInputElement>('suAdult').checked;
  const terms = $<HTMLInputElement>('suTerms').checked;
  if (!adult || !terms)
    return ($('suError').textContent = 'Du skal være fyldt 18 og acceptere vilkårene.');
  const invite = $<HTMLInputElement>('suInvite').value.trim() || undefined;
  if (authMode === 'profile') {
    try {
      const password = $<HTMLInputElement>('suPw').value || undefined;
      await exchange({ name, look: signupLook, invite, adult, terms, password });
    } catch {
      $('suError').textContent = 'Kan ikke nå hotellet lige nu. Prøv igen om lidt.';
    }
    return;
  }
  try {
    const res = await fetch(`${SERVER}/api/guest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        look: signupLook,
        password: $<HTMLInputElement>('suPw').value,
        invite,
        adult,
        terms,
      }),
    });
    const data = (await res.json()) as { ok: boolean; token?: string; error?: string };
    if (!data.ok || !data.token)
      return ($('suError').textContent = data.error ?? 'Noget gik galt.');
    store.set(TOKEN_KEY, data.token);
    start(data.token);
  } catch {
    $('suError').textContent = 'Kan ikke nå hotellet lige nu. Prøv igen om lidt.';
  }
});

function start(token: string) {
  net?.close();
  net = new Net(WS_URL, token);
  audio.setClock(() => (net ? net.now() : Date.now()));
  net.onMessage = handle;
  // A short drop (a deploy or a hiccup) goes unnoticed: only say something after a few seconds.
  let offlineTimer = 0;
  net.onStatus = (s) => {
    clearTimeout(offlineTimer);
    if (s === 'offline')
      offlineTimer = window.setTimeout(() => $('conn').classList.remove('hidden'), 4000);
    else $('conn').classList.add('hidden');
  };
  net.onFatal = (code) => {
    if (code === 4001) {
      store.set(TOKEN_KEY, null);
      showSignup('Du er blevet logget ud – log ind igen.', social() ? 'social' : 'login');
    } else if (code === 4003) toast('Din konto er midlertidigt udelukket.', 'error');
    else if (code === 4000) toast('Du er logget ind et andet sted.', 'error');
  };
  net.connect();
}

/* ---------------- loop ---------------- */
const v3 = new T.Vector3();
function screen(a: Actor, yOff: number): [number, number] {
  return screenAt(a.obj, yOff);
}
function screenAt(o: T.Object3D, yOff: number): [number, number] {
  v3.set(o.position.x, o.position.y + yOff, o.position.z).project(stage.camera);
  return [((v3.x + 1) / 2) * innerWidth, ((1 - v3.y) / 2) * innerHeight];
}
const clock = new T.Clock();
let time = 0;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  const now = net ? net.now() : Date.now();
  keyboardWalk(dt);
  for (const a of actors.values()) a.update(dt, now, items, groundAt);
  for (const p of pets.values()) {
    const o = actors.get(p.ownerId);
    if (o) p.update(dt, o.obj.position, groundAt(p.x + rs() / 2 - 0.5, p.z + rs() / 2 - 0.5));
  }
  roomGfx.update(dt, time);
  for (const g of objs.values()) {
    if (g.userData.tv) drawTv(g.userData.tv as Parameters<typeof drawTv>[0], time);
    if (g.userData.type === 'aquarium')
      g.traverse((m) => {
        if (m instanceof T.Mesh && m.scale.x > 1.5)
          m.position.x = Math.sin(time * 0.8 + m.position.y * 10) * 0.25;
      });
  }
  for (const a of actors.values()) {
    const [x, y] = screen(a, 1.5);
    a.tag.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
  }
  const t = performance.now();
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]!;
    const age = (t - b.born) / 1000;
    const pet = b.who.startsWith('pet:') ? pets.get(b.who.slice(4)) : undefined;
    const anchor = pet ? pet.obj : actors.get(b.who)?.obj;
    if (age > 7 || !anchor) {
      b.el.remove();
      bubbles.splice(i, 1);
      continue;
    }
    const [x, y] = screenAt(anchor, pet ? 0.7 : 1.5);
    b.el.style.transform = `translate(${x}px,${y - 26 - b.off - age * 5}px) translate(-50%,-100%)`;
    b.el.style.opacity = String(age > 5.5 ? Math.max(0, (7 - age) / 1.5) : 1);
  }
  updateJukeboxVolumes();
  updateFloats(t);
  stage.render();
  requestAnimationFrame(loop);
}

roomGfx.setTheme('home');
async function boot() {
  authCfg = await loadConfig(SERVER);
  const saved = store.get(TOKEN_KEY);
  if (social() && (isAuthRedirect() || !saved)) {
    try {
      if (await exchange()) return;
    } catch {
      /* fall through to the login screen */
    }
  }
  if (saved) start(saved);
  else showSignup();
}
void boot();
loop();
